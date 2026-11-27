-- Etapa 2 · Financeiro (v1.8.0)
-- Pagamento manual com Pix. Planos, assinaturas e faturas geradas pelo banco.
-- Avisos e bloqueio por atraso configuráveis (bloqueio vem desligado).
-- Não apaga nada. Única alteração em tabela existente: client_info ganha billing_blocked.

-- data de hoje no fuso do Recife
create or replace function public.fin_today() returns date
language sql stable set search_path to 'public' as $$ select (now() at time zone 'America/Recife')::date $$;

-- configurações (linha única)
create table if not exists public.fin_settings (
  id                int primary key default 1 check (id = 1),
  pix_key           text check (pix_key is null or length(pix_key) <= 140),
  pix_name          text check (pix_name is null or length(pix_name) <= 80),
  alert_days_before int default 3 check (alert_days_before is null or alert_days_before between 1 and 30),
  alert_on_due      boolean not null default true,
  block_after_days  int check (block_after_days is null or block_after_days between 1 and 90),  -- null = bloqueio desligado
  updated_by        uuid references public.profiles(id),
  updated_at        timestamptz not null default now()
);
insert into public.fin_settings (id) values (1) on conflict do nothing;
alter table public.fin_settings enable row level security;
create policy fs_sel on public.fin_settings for select to authenticated using (public.is_master());
create policy fs_upd on public.fin_settings for update to authenticated using (public.is_master()) with check (public.is_master());

-- planos de cobrança
create table if not exists public.fin_plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 60),
  price      numeric(10,2) not null check (price > 0 and price < 100000),
  months     int not null check (months in (1,3,6,12)),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.fin_plans enable row level security;
create policy fp_all on public.fin_plans for all to authenticated using (public.is_master()) with check (public.is_master());

-- assinatura do aluno (uma ativa por aluno)
create table if not exists public.fin_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  plan_id    uuid references public.fin_plans(id) on delete set null,
  plan_name  text not null check (length(plan_name) between 1 and 60),
  price      numeric(10,2) not null check (price >= 0 and price < 100000),
  months     int not null check (months in (1,3,6,12)),
  due_day    int not null check (due_day between 1 and 28),
  start_date date not null,
  end_date   date,
  active     boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists fin_sub_one_active on public.fin_subscriptions (user_id) where active;
alter table public.fin_subscriptions enable row level security;
create policy fsub_all on public.fin_subscriptions for all to authenticated using (public.is_master()) with check (public.is_master());

-- faturas
create table if not exists public.fin_invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.fin_subscriptions(id) on delete set null,
  period_date     date,                                   -- competência original (não muda ao prorrogar)
  description     text not null check (length(description) between 1 and 120),
  due_date        date not null,
  amount          numeric(10,2) not null check (amount >= 0 and amount < 100000),
  status          text not null default 'aberta' check (status in ('aberta','paga','cancelada')),
  paid_at         date,
  paid_amount     numeric(10,2) check (paid_amount is null or (paid_amount >= 0 and paid_amount < 100000)),
  method          text check (method is null or method in ('pix','dinheiro','cartao','transferencia','outro')),
  notes           text check (notes is null or length(notes) <= 300),
  created_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz not null default now(),
  check (status <> 'paga' or (paid_at is not null and paid_amount is not null))
);
create unique index if not exists fin_inv_period on public.fin_invoices (subscription_id, period_date) where subscription_id is not null;
create index if not exists fin_inv_user on public.fin_invoices (user_id, due_date desc);
create index if not exists fin_inv_open on public.fin_invoices (due_date) where status = 'aberta';
alter table public.fin_invoices enable row level security;
create policy fi_sel on public.fin_invoices for select to authenticated
  using (public.is_master() or (user_id = auth.uid() and public.is_active()));
create policy fi_ins on public.fin_invoices for insert to authenticated with check (public.is_master());
create policy fi_upd on public.fin_invoices for update to authenticated using (public.is_master()) with check (public.is_master());
create policy fi_del on public.fin_invoices for delete to authenticated using (public.is_master());

-- marca quem foi bloqueado pela cobrança (para liberar sozinho quando pagar)
alter table public.client_info add column if not exists billing_blocked boolean not null default false;

-- rotina: gera faturas, bloqueia por atraso (se ligado) e libera quem regularizou
create or replace function public.fin_job(p_user uuid default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  st      public.fin_settings;
  s       record;
  d       date;
  n       int;
  today   date := public.fin_today();
  horizon date;
begin
  select * into st from public.fin_settings where id = 1;
  horizon := today + coalesce(st.alert_days_before, 3) + 7;

  -- 1) gerar faturas das assinaturas ativas de alunos ativos (pausado/encerrado não gera)
  for s in
    select sub.* from public.fin_subscriptions sub
    join public.profiles p on p.id = sub.user_id
    left join public.client_info ci on ci.user_id = sub.user_id
    where sub.active and p.role = 'user' and coalesce(ci.status, 'ativo') = 'ativo'
      and (p_user is null or sub.user_id = p_user)
  loop
    select max(period_date) into d from public.fin_invoices where subscription_id = s.id;
    if d is null then
      d := make_date(extract(year from s.start_date)::int, extract(month from s.start_date)::int, s.due_day);
      if d < s.start_date then d := (d + interval '1 month')::date; end if;
    else
      d := (d + make_interval(months => s.months))::date;
    end if;
    n := 0;
    while d <= horizon and (s.end_date is null or d <= s.end_date) and n < 24 loop
      insert into public.fin_invoices (user_id, subscription_id, period_date, description, due_date, amount)
      values (s.user_id, s.id, d, s.plan_name || ' · ' || to_char(d, 'MM/YYYY'), d, s.price)
      on conflict do nothing;
      d := (d + make_interval(months => s.months))::date;
      n := n + 1;
    end loop;
  end loop;

  -- 2) bloquear quem passou do prazo (só se o bloqueio estiver ligado)
  if st.block_after_days is not null then
    insert into public.client_info (user_id, billing_blocked)
    select distinct i.user_id, true
    from public.fin_invoices i
    join public.profiles p on p.id = i.user_id
    left join public.client_info ci on ci.user_id = i.user_id
    where i.status = 'aberta' and i.due_date + st.block_after_days < today
      and p.role = 'user' and p.active and coalesce(ci.status, 'ativo') = 'ativo'
      and (p_user is null or i.user_id = p_user)
    on conflict (user_id) do update set billing_blocked = true;

    update public.profiles p set active = false
    from public.client_info ci
    where ci.user_id = p.id and ci.billing_blocked and p.active and p.role = 'user'
      and (p_user is null or p.id = p_user)
      and exists (select 1 from public.fin_invoices i where i.user_id = p.id and i.status = 'aberta'
                  and i.due_date + st.block_after_days < today);
  end if;

  -- 3) liberar quem foi bloqueado pela cobrança e regularizou (ou foi pausado pelo treinador)
  update public.profiles p set active = true
  from public.client_info ci
  where ci.user_id = p.id and ci.billing_blocked and not p.active and ci.status <> 'encerrado'
    and (p_user is null or p.id = p_user)
    and (ci.status = 'pausado' or not exists (
          select 1 from public.fin_invoices i where i.user_id = p.id and i.status = 'aberta'
          and st.block_after_days is not null and i.due_date + st.block_after_days < today));
  update public.client_info ci set billing_blocked = false
  from public.profiles p
  where p.id = ci.user_id and ci.billing_blocked and (p.active or ci.status = 'encerrado')
    and (p_user is null or ci.user_id = p_user);
end $$;
revoke all on function public.fin_job(uuid) from public, anon, authenticated;

-- master: roda a rotina agora (ao abrir o Financeiro e depois de dar baixa)
create or replace function public.fin_refresh() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_master() then raise exception 'Apenas o master'; end if;
  perform public.fin_job(null);
end $$;
revoke all on function public.fin_refresh() from public, anon;
grant execute on function public.fin_refresh() to authenticated;

-- aluno: suas faturas, chave Pix e avisos (funciona também quando está bloqueado por atraso)
create or replace function public.my_billing() returns json
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); st public.fin_settings; r json;
begin
  if uid is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.profiles where id = uid and role = 'user') then perform public.fin_job(uid); end if;
  select * into st from public.fin_settings where id = 1;
  select json_build_object(
    'today', public.fin_today(),
    'pix_key', st.pix_key, 'pix_name', st.pix_name,
    'alert_days_before', st.alert_days_before, 'alert_on_due', st.alert_on_due, 'block_after_days', st.block_after_days,
    'status', coalesce((select status from public.client_info where user_id = uid), 'ativo'),
    'blocked', coalesce((select billing_blocked from public.client_info where user_id = uid), false),
    'invoices', coalesce((select json_agg(x) from (
        select id, description, due_date, amount, status, paid_at, paid_amount, method
        from public.fin_invoices where user_id = uid and status <> 'cancelada'
        order by due_date desc limit 12) x), '[]'::json)
  ) into r;
  return r;
end $$;
revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;

revoke all on public.fin_settings, public.fin_plans, public.fin_subscriptions, public.fin_invoices from anon;

-- @@CRON (rodar uma vez por dia, 06:07 no Recife)
create extension if not exists pg_cron;
select cron.schedule('fin-diario', '7 9 * * *', $$select public.fin_job(null)$$);
