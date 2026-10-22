-- ============================================================================
-- Photo processing v1: thumbnails + 12 MB upload ceiling
-- ============================================================================
-- Extends `post_media` with a thumbnail object key (+ dimensions) so the feed
-- can render a small WebP thumbnail and only fetch full-resolution bytes on
-- demand. Also raises the `post-media` bucket upload ceiling to 12 MB (the
-- pre-processing limit; processed WebP objects are far smaller).
--
-- Reversible: dropping the columns and resetting the bucket restores v1. No
-- data is destroyed.
-- ============================================================================

-- 1. Thumbnail columns on post_media. Shape mirrors storage_key: a
--    `<owner>/<uuid>.webp` path the publish action builds itself.
alter table public.post_media
  add column if not exists thumbnail_key text unique
    check (thumbnail_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$');

alter table public.post_media
  add column if not exists thumb_width int check (thumb_width >= 1);

alter table public.post_media
  add column if not exists thumb_height int check (thumb_height >= 1);

create index if not exists post_media_thumbnail_key_idx
  on public.post_media (thumbnail_key)
  where thumbnail_key is not null;

comment on column public.post_media.thumbnail_key is
  'WebP thumbnail object path in the `post-media` bucket, built by the publish action.';
comment on column public.post_media.thumb_width is 'Thumbnail width in pixels.';
comment on column public.post_media.thumb_height is 'Thumbnail height in pixels.';

-- 2. Raise the `post-media` bucket ceiling to 12 MB (pre-processing limit).
--    Processed WebP uploads are much smaller, but the bucket is the outer
--    backstop for any bytes that reach Storage directly.
do $$
begin
  update storage.buckets
     set file_size_limit = 12582912 -- 12 MB
   where id = 'post-media';
end $$;

-- 3. Extend `create_post()` to atomically store the thumbnail alongside the
--    full-resolution image. All media parameters keep their names and defaults
--    so text-only callers (`create_post(p_body)`) still work unchanged; new
--    thumbnail parameters are appended at the end.
drop function if exists public.create_post(text, text, text, bigint, int, int, text);

create or replace function public.create_post(
  p_body text,
  p_media_alt text default null,
  p_media_height int default null,
  p_media_key text default null,
  p_media_mime text default null,
  p_media_size bigint default null,
  p_media_width int default null,
  p_media_thumbnail_key text default null,
  p_thumb_height int default null,
  p_thumb_width int default null
) returns string
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
  v_thumb_key text := p_media_thumbnail_key;
  v_thumb_w int := p_thumb_width;
  v_thumb_h int := p_thumb_height;
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

  -- Thumbnail, when present, must be a WebP within thumbnail bounds.
  if v_thumb_key is not null then
    if v_thumb_w is null or v_thumb_w < 1
       or v_thumb_h is null or v_thumb_h < 1 then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
  end if;

  -- The object must live in the caller's own folder (uploads are RLS-bound
  -- to it; this closes the gap for a caller passing someone else's key).
  if split_part(p_media_key, '/', 1) <> v_me::text then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;
  if v_thumb_key is not null and split_part(v_thumb_key, '/', 1) <> v_me::text then
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
     alt_text, thumbnail_key, thumb_width, thumb_height, display_order)
  values (
    v_id,
    v_me,
    p_media_key,
    v_mime,
    v_size,
    v_width,
    v_height,
    v_alt,
    v_thumb_key,
    v_thumb_w,
    v_thumb_h,
    0
  );

  return v_id;
end;
$$;

comment on function public.create_post(text, text, text, bigint, int, int, text, text, int, int) is
  'Atomic publish: text post or photo post with optional WebP thumbnail. Enforces media bounds; idempotent per uploaded storage key.';

revoke execute on function public.create_post(text, text, text, bigint, int, int, text, text, int, int) from public;
grant execute on function public.create_post(text, text, text, bigint, int, int, text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   drop function if exists public.create_post(text, text, text, bigint, int, int, text, text, int, int);
--   -- recreate the 7-arg v1 function if needed; post_media thumbnail columns dropped above.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   alter table public.post_media drop column if exists thumbnail_key;
--   alter table public.post_media drop column if exists thumb_width;
--   alter table public.post_media drop column if exists thumb_height;
--   drop index if exists public.post_media_thumbnail_key_idx;
--   update storage.buckets set file_size_limit = 10485760 where id = 'post-media';
-- ---------------------------------------------------------------------------
