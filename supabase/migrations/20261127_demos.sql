-- Demonstração personalizada por exercício (vídeo e/ou passos), editada pelo master.
-- Vale para exercícios do banco fixo do app (id 'c_...') e para os criados no banco (id 'u_<uuid>').
-- Sem linha aqui, o app usa a demonstração padrão de exercicios.js.

create table if not exists public.exercise_media (
  cat_id      text primary key
              check (cat_id ~ '^(c_[a-z0-9-]{1,80}|u_[0-9a-f-]{36})$'),
  video_url   text
              check (video_url is null or (video_url ~ '^https://' and length(video_url) <= 500)),
  instrucoes  text
              check (instrucoes is null or length(instrucoes) <= 2000),
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.exercise_media enable row level security;

-- alunos e masters ativos leem; só master grava ou apaga
create policy media_sel on public.exercise_media for select to authenticated using (is_active());
create policy media_ins on public.exercise_media for insert to authenticated with check (is_master());
create policy media_upd on public.exercise_media for update to authenticated using (is_master()) with check (is_master());
create policy media_del on public.exercise_media for delete to authenticated using (is_master());
