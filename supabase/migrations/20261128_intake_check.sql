-- Permite registrar a consulta "e-mail já cadastrado?" do formulário público (ação check da função public-intake)
alter table public.intake_attempts drop constraint if exists intake_attempts_kind_check;
alter table public.intake_attempts add constraint intake_attempts_kind_check check (kind in ('submit','resend','check'));
