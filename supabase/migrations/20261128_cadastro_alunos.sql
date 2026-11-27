-- Etapa 1 · Cadastro do aluno (v1.7.0)
-- client_info: dados de cadastro de cada aluno (master edita; o aluno só lê os próprios).
-- coach_notes: anotações do treinador (só masters leem e gravam; o aluno nunca vê).
-- Não altera nem apaga nenhuma tabela existente.

create table if not exists public.client_info (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  phone       text check (phone is null or phone ~ '^[0-9]{10,13}$'),          -- só dígitos, com DDI (ex.: 5581999990000)
  birth_date  date check (birth_date is null or (birth_date between date '1900-01-01' and current_date)),
  gender      text check (gender is null or gender in ('M','F','O','N')),       -- M, F, Outro, Prefere não informar
  goal_group  text check (goal_group is null or length(goal_group) between 1 and 40),
  modality    text check (modality is null or modality in ('online','presencial','hibrido')),
  start_date  date,
  status      text not null default 'ativo' check (status in ('ativo','pausado','encerrado')),
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.client_info enable row level security;

create policy ci_sel on public.client_info for select to authenticated
  using (public.is_master() or (user_id = auth.uid() and public.is_active()));
create policy ci_ins on public.client_info for insert to authenticated with check (public.is_master());
create policy ci_upd on public.client_info for update to authenticated using (public.is_master()) with check (public.is_master());
create policy ci_del on public.client_info for delete to authenticated using (public.is_master());

create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  author      uuid references public.profiles(id) default auth.uid(),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists coach_notes_user_idx on public.coach_notes (user_id, created_at desc);

alter table public.coach_notes enable row level security;

create policy cn_sel on public.coach_notes for select to authenticated using (public.is_master());
create policy cn_ins on public.coach_notes for insert to authenticated with check (public.is_master() and author = auth.uid());
create policy cn_del on public.coach_notes for delete to authenticated using (public.is_master() and author = auth.uid());

-- acesso só para usuários logados (nada para anônimos)
revoke all on public.client_info, public.coach_notes from anon;
grant select, insert, update, delete on public.client_info to authenticated;
grant select, insert, delete on public.coach_notes to authenticated;
