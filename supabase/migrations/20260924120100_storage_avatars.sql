-- ============================================================================
-- M1 — Storage bucket for profile photos
--
-- Uploads go browser → Supabase Storage (never through a Next.js route or
-- server action): serverless request bodies are capped at ~4.5 MB on Vercel,
-- and a signed upload URL keeps the bytes off the function entirely. A server
-- action checks permission first and mints the URL; the browser PUTs the file.
--
-- Object layout:  avatars/<user_id>/<file>
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false, -- private: reads go through the policies below, not public URLs
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------

-- Any signed-in member can read profile photos (the feed shows them). Images
-- are not public: the bucket stays private and reads need a session.
drop policy if exists avatars_select_authenticated on storage.objects;
create policy avatars_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- Members can only write inside their own folder.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
