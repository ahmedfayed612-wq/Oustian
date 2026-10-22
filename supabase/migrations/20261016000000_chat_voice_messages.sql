-- ============================================================================
-- Voice messages: type-aware chat + private audio bucket
--
-- Adds the voice-specific columns to `messages`, relaxes the text-only body
-- rule (a voice message has no body), and creates the private `voice` bucket
-- that holds the recordings. The bucket is browser -> Storage only, so audio
-- bytes never cross a Vercel function.
--
-- `messages` keeps its existing realtime publication, so a voice row is
-- delivered to the recipient exactly like a text row — same pipeline, no
-- second messaging system.
-- ============================================================================

-- 1. Type-aware messages. All voice columns are nullable so existing rows keep
--    working and text messages simply leave them null.
alter table public.messages
  add column if not exists type text not null default 'text'
  check (type in ('text', 'voice'));

alter table public.messages
  add column if not exists audio_path text;
alter table public.messages
  add column if not exists duration_ms integer;
alter table public.messages
  add column if not exists mime_type text;
alter table public.messages
  add column if not exists file_size_bytes bigint;
alter table public.messages
  add column if not exists waveform_data jsonb;

create index if not exists messages_audio_path_idx
  on public.messages (audio_path);

-- 2. The original table only allowed non-empty bodies. A voice message has
--    none, so the bound becomes conditional: text still needs 1..2000 chars,
--    voice needs none. (Same shape as the photo-posts migration.)
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (
    (type = 'text' and char_length(btrim(body)) between 1 and 2000)
    or (type = 'voice' and char_length(btrim(body)) = 0)
  );

-- 3. Private `voice` bucket: browser -> Storage, folder-isolated per owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice',
  'voice',
  false,
  15728640, -- 15 MB
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists voice_select on storage.objects;
create policy voice_select on storage.objects
  for select to authenticated
  using (bucket_id = 'voice' and public.is_approved_member());

drop policy if exists voice_insert_own on storage.objects;
create policy voice_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_member()
  );

-- No update policy: stored recordings are immutable. Delete is owner-only so
-- a failed upload can be cleaned up and a message's audio can be retracted.
drop policy if exists voice_delete_own on storage.objects;
create policy voice_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voice'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
