-- ============================================================================
-- Fix create_post() after thumbnail columns were removed
-- ============================================================================
--
-- Migration 20261027000001_remove_thumbnail_columns.sql dropped the
-- thumbnail_key / thumb_width / thumb_height columns from public.post_media
-- but did NOT update public.create_post(). The function still references
-- those dropped columns in its INSERT, so every photo-post publish fails
-- with: column "thumbnail_key" of relation "post_media" does not exist.
--
-- This migration recreates create_post() without the thumbnail parameters,
-- matching the current schema (full-resolution only). The 7-parameter
-- signature is identical to the original post_media_photo_posts migration;
-- text-only callers (create_post(p_body)) are unaffected.
--
-- No data is dropped or modified. Existing posts and their media remain
-- fully accessible.
-- ============================================================================

-- 1. Drop all existing versions of create_post(). The thumbnail migration
--    left a 10-argument version (returning string) whose INSERT references
--    the dropped thumbnail columns. `CREATE OR REPLACE` cannot change a
--    function's return type, so every existing version must be dropped first.
drop function if exists public.create_post(text, text, integer, text, text, bigint, integer, text, integer, integer);
drop function if exists public.create_post(text, text, integer, text, text, bigint, integer);

-- 2. Recreate create_post() with the 7-argument signature. The INSERT into
--    post_media writes only the columns that exist in the current schema:
--    (post_id, created_by, storage_key, mime_type, file_size, width, height,
--     alt_text, display_order) — no thumbnail columns.
create or replace function public.create_post(
  p_body text,
  p_media_alt text default null,
  p_media_height int default null,
  p_media_key text default null,
  p_media_mime text default null,
  p_media_size bigint default null,
  p_media_width int default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if char_length(v_body) > 5000 then
    raise exception 'post_too_long' using errcode = 'check_violation';
  end if;

  -- Text post: content must exist.
  if p_media_key is null then
    if v_body = '' then
      raise exception 'empty_post' using errcode = 'check_violation';
    end if;

    insert into public.posts (id, author_id, body)
    values (gen_random_uuid(), v_me, v_body)
    returning id into v_id;

    return v_id;
  end if;

  -- Photo post: metadata must be complete and sane.
  if p_media_mime is null
     or p_media_mime not in ('image/jpeg', 'image/png', 'image/webp')
     or p_media_size is null or p_media_size not between 1 and 10485760
     or p_media_width is null or p_media_width < 200
     or p_media_height is null or p_media_height < 200 then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  -- The object must live in the caller's own folder.
  if split_part(p_media_key, '/', 1) <> v_me::text then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  -- Idempotent retry: this upload already became a post — return it.
  select post_id into v_id
  from public.post_media
  where storage_key = p_media_key;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.posts (id, author_id, body)
  values (gen_random_uuid(), v_me, v_body)
  returning id into v_id;

  insert into public.post_media
    (post_id, created_by, storage_key, mime_type, file_size, width, height, alt_text, display_order)
  values (
    v_id,
    v_me,
    p_media_key,
    p_media_mime,
    p_media_size,
    p_media_width,
    p_media_height,
    nullif(btrim(coalesce(p_media_alt, '')), ''),
    0
  );

  return v_id;
end;
$$;

comment on function public.create_post(text, text, integer, text, text, bigint, integer) is
  'Atomic publish: text post or photo post. Full-resolution only; no thumbnail columns. Enforces media bounds; idempotent per uploaded storage key.';

revoke execute on function public.create_post(text, text, integer, text, text, bigint, integer) from public;
grant execute on function public.create_post(text, text, integer, text, text, bigint, integer) to authenticated;