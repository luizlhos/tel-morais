-- v1.9.1 · Manual do treinador em PDF, privado (só master lê e grava)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('master-docs', 'master-docs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy mdocs_sel on storage.objects for select to authenticated
  using (bucket_id = 'master-docs' and public.is_master());
create policy mdocs_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'master-docs' and public.is_master());
create policy mdocs_upd on storage.objects for update to authenticated
  using (bucket_id = 'master-docs' and public.is_master())
  with check (bucket_id = 'master-docs' and public.is_master());
create policy mdocs_del on storage.objects for delete to authenticated
  using (bucket_id = 'master-docs' and public.is_master());
