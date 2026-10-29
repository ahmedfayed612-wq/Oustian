-- ============================================================================
-- Fix create_post() after thumbnail columns were removed
-- ============================================================================
-- Migration 20261027000001_remove_thumbnail_columns.sql dropped the
-- thumbnail_key, thumb_width, thumb_height columns from post_media, but the
-- create_post() RPC function (defined in 20261020000001_photo_thumbnails.sql)
-- still inserts into those columns. Every photo-post publish therefore fails
-- with "column does not exist".
--
-- This migration recreates create_post() without the thumbnail parameters and
-- without referencing the dropped columns. Text-only callers (create_post(p_body))
-- keep working unchanged.
-- ============================================================================

-- Drop the 10-parameter version that still references thumbnail columns.
drop function if exists public.create_post(text, text, int, text, text, bigint, int, text, int, int);

create or replace function public.create_post(
  p_body text,
  p_media_alt text default null,
  p_media_height int default null,
  p_media_key text default null,
  p_media_mime text default null,
  p_media_size bigint default null,
  p_media_width int default null
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_body text := coalesce(btrim(p_body), '');
  v_mime text := p_media_mime;
  v_size bigint := p_media_size;
  v_width int := p_media_width;
  v_height int := p_media_height;
  v_alt text := nullif(btrim(coalesce(p_media_alt, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_approved_member(v_me) then
    raise exception 'not_authorised';
  end if;

  if char_length(v_body) > 5000 then
    raise exception 'post_too_long' using errcode = 'check_violation';
  end if;

  -- Text-only post: content must exist.
  if p_media_key is null then
    if v_body = '' then
      raise exception 'empty_post' using errcode = 'check_violation';
    end if;

    insert into public.posts (id, author_id, body)
    values (gen_random_uuid(), v_me, v_body)
    returning id into v_id;

    return v_id;
  end if;

  -- Photo post: validate media bounds (mirrors the table checks + bucket).
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp')
     or v_size is null or v_size not between 1 and 12582912
     or v_width is null or v_width < 200
     or v_height is null or v_height < 200 then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  -- The object must live in the caller's own folder (uploads are RLS-bound
  -- to it; this closes the gap for a caller passing someone else's key).
  if split_part(p_media_key, '/', 1) <> v_me::text then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  -- Idempotent retry: this full-resolution upload already became a post.
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
    (post_id, created_by, storage_key, mime_type, file_size, width, height,
     alt_text, display_order)
  values (
    v_id,
    v_me,
    p_media_key,
    v_mime,
    v_size,
    v_width,
    v_height,
    v_alt,
    0
  );

  return v_id;
end;
$$;

comment on function public.create_post(text, text, int, text, text, bigint, int) is
  'Atomic publish: text post or photo post. Enforces media bounds; idempotent per uploaded storage key.';

revoke execute on function public.create_post(text, text, int, text, text, bigint, int) from public;
grant execute on function public.create_post(text, text, int, text, text, bigint, int) to authenticated;