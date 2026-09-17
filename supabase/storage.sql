-- =====================================================================
--  Carnet de suivi — rangement privé des fichiers (planche, photos…)
--  À lancer une fois dans Supabase → SQL Editor. Réservé aux membres.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists documents_select on storage.objects;
create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member());
drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_member());
drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_member());
drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_member());
