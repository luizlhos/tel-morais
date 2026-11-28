-- Teste grátis de 15 dias para alunos sem plano financeiro + WhatsApp do treinador (28/11/2026)
-- Não apaga nada. Colunas novas em fin_settings e client_info; fin_job e my_billing ganham o teste grátis.

alter table public.fin_settings add column if not exists trial_days int default 15
  check (trial_days is null or trial_days between 1 and 90);                       -- null = teste grátis desligado
alter table public.fin_settings add column if not exists coach_whatsapp text
  check (coach_whatsapp is null or coach_whatsapp ~ '^[0-9]{10,13}$');               -- só números, com DDI/DDD
alter table public.client_info add column if not exists trial_blocked boolean not null default false;
alter table public.client_info add column if not exists trial_until date;          -- prazo estendido pelo treinador

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

  -- 4) teste grátis: aluno ativo sem assinatura ativa perde o acesso depois de N dias do cadastro
  --    (ou da data estendida pelo treinador em client_info.trial_until). N = fin_settings.trial_days (null = desligado)
  if st.trial_days is not null then
    insert into public.client_info (user_id, trial_blocked)
    select p.id, true
    from public.profiles p
    left join public.client_info ci on ci.user_id = p.id
    where p.role = 'user' and p.active and coalesce(ci.status, 'ativo') = 'ativo'
      and (p_user is null or p.id = p_user)
      and not exists (select 1 from public.fin_subscriptions fs where fs.user_id = p.id and fs.active)
      and coalesce(ci.trial_until, (p.created_at at time zone 'America/Recife')::date + st.trial_days - 1) < today
    on conflict (user_id) do update set trial_blocked = true;

    update public.profiles p set active = false
    from public.client_info ci
    where ci.user_id = p.id and ci.trial_blocked and p.active and p.role = 'user'
      and (p_user is null or p.id = p_user);
  end if;

  -- 5) liberar quem estava bloqueado pelo fim do teste e ganhou assinatura, teve o prazo estendido ou o teste foi desligado
  update public.profiles p set active = true
  from public.client_info ci
  where ci.user_id = p.id and ci.trial_blocked and not p.active and ci.status <> 'encerrado' and not ci.billing_blocked
    and (p_user is null or p.id = p_user)
    and (st.trial_days is null
         or exists (select 1 from public.fin_subscriptions fs where fs.user_id = p.id and fs.active)
         or coalesce(ci.trial_until, (p.created_at at time zone 'America/Recife')::date + st.trial_days - 1) >= today);
  update public.client_info ci set trial_blocked = false
  from public.profiles p
  where p.id = ci.user_id and ci.trial_blocked and (p.active or ci.status = 'encerrado')
    and (p_user is null or ci.user_id = p_user);
end $$;
revoke all on function public.fin_job(uuid) from public, anon, authenticated;

create or replace function public.my_billing() returns json
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); st public.fin_settings; r json; has_sub boolean; tend date;
begin
  if uid is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.profiles where id = uid and role = 'user') then perform public.fin_job(uid); end if;
  select * into st from public.fin_settings where id = 1;
  has_sub := exists (select 1 from public.fin_subscriptions fs where fs.user_id = uid and fs.active);
  if st.trial_days is not null and not has_sub then
    select coalesce(ci.trial_until, (p.created_at at time zone 'America/Recife')::date + st.trial_days - 1) into tend
    from public.profiles p left join public.client_info ci on ci.user_id = p.id where p.id = uid and p.role = 'user';
  end if;
  select json_build_object(
    'today', public.fin_today(),
    'pix_key', st.pix_key, 'pix_name', st.pix_name,
    'alert_days_before', st.alert_days_before, 'alert_on_due', st.alert_on_due, 'block_after_days', st.block_after_days,
    'status', coalesce((select status from public.client_info where user_id = uid), 'ativo'),
    'blocked', coalesce((select billing_blocked from public.client_info where user_id = uid), false),
    'trial_blocked', coalesce((select trial_blocked from public.client_info where user_id = uid), false),
    'trial_end', tend, 'has_sub', has_sub, 'coach_whatsapp', st.coach_whatsapp,
    'invoices', coalesce((select json_agg(x) from (
        select id, description, due_date, amount, status, paid_at, paid_amount, method
        from public.fin_invoices where user_id = uid and status <> 'cancelada'
        order by due_date desc limit 12) x), '[]'::json)
  ) into r;
  return r;
end $$;
revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;
