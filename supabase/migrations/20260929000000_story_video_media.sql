-- ============================================================================
-- Story media: videos
--
-- A story is no longer a photo-only canvas. Everything the story migration
-- (20260926120000) built stays exactly as it is — visibility, expiry, views,
-- the `create_story` signature and its grants — this migration widens the
-- *media policy* in the three places that encoded "image only":
--
--   1. `story_media` check constraints (key shape, mime, size)
--   2. `create_story()`      (the same key/mime/size re-checks)
--   3. the private `story-media` bucket (allowed mime types, size ceiling)
--
-- Two bounds are deliberate:
--   * the bucket carries ONE `file_size_limit` for every object, so it is set
--     to the video ceiling (50 MB) and the per-kind bound (10 MB for images,
--     50 MB for videos) is enforced by the app action and by the table check
--     below — the bucket is the outer backstop, not the policy;
--   * container bytes are still verified server-side (`sniffVideo`), so a
--     renamed non-video file can never be stored as one. Video *dimensions*
--     come from the composer's `<video>` metadata probe (the browser already
--     applies rotation, which a raw container parse would not), bounded here
--     to the same 200 px minimum images must meet.
--
-- Idempotent: constraints are dropped by lookup and the function is replaced
-- in place, so re-running this file changes nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. `story_media` check constraints — image-only → image + video
-- ---------------------------------------------------------------------------

-- Constraints are declared inline in the base migration, so their generated
-- names are an implementation detail. Look them up per column instead of
-- hard-coding names, then re-add the widened versions.
do $$
declare
  target record;
begin
  for target in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'story_media'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%storage_key%'
        or pg_get_constraintdef(con.oid) ilike '%mime_type%'
        or pg_get_constraintdef(con.oid) ilike '%file_size%'
      )
  loop
    execute format('alter table public.story_media drop constraint %I', target.conname);
  end loop;
end $$;

alter table public.story_media
  add constraint story_media_storage_key_check
  check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|mov|webm)$');

alter table public.story_media
  add constraint story_media_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp',
                       'video/mp4', 'video/quicktime', 'video/webm'));

-- 50 MB: the video ceiling. Images stay capped at 10 MB by the publish action
-- (`MAX_IMAGE_BYTES`), which is the check that actually runs for a photo.
alter table public.story_media

-- ---------------------------------------------------------------------------
-- 2. `create_story()` — same signature, same grants, widened media policy
-- ---------------------------------------------------------------------------

create or replace function public.create_story(
  p_media_key text,
  p_media_mime text,
  p_media_size bigint,
  p_media_width int,
  p_media_height int,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_existing uuid;
  v_story uuid;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  -- The key must live in the caller's own folder: identity is never taken
  -- from the payload, and a forged path can never point at another member.
  if p_media_key is null
     or p_media_key !~ ('^' || v_me::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|mov|webm)$') then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_media_mime not in ('image/jpeg', 'image/png', 'image/webp',
                          'video/mp4', 'video/quicktime', 'video/webm') then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_media_size is null or p_media_size < 1 or p_media_size > 52428800 then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_media_width is null or p_media_height is null
     or p_media_width < 200 or p_media_height < 200 then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_caption is not null and char_length(btrim(p_caption)) > 280 then
    raise exception 'invalid_caption' using errcode = 'check_violation';
  end if;

  select m.story_id into v_existing
  from public.story_media m
  where m.storage_key = p_media_key
    and m.created_by = v_me;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.stories (author_id, visibility, expires_at)
  values (v_me, 'connections', now() + interval '24 hours')
  returning id into v_story;

  insert into public.story_media
    (story_id, created_by, storage_key, mime_type, file_size, width, height, caption, display_order)
  values (
    v_story,
    v_me,
    p_media_key,
    p_media_mime,
    p_media_size,
    p_media_width,
    p_media_height,
    nullif(btrim(coalesce(p_caption, '')), ''),
    0
  );

  return v_story;
end;
$$;

comment on function public.create_story(text, text, bigint, int, int, text) is
  'Atomic story publish: story + photo/video in one transaction, idempotent per uploaded storage key.';

-- ---------------------------------------------------------------------------
-- 3. Storage bucket `story-media` — allow video containers, raise the ceiling
-- ---------------------------------------------------------------------------

update storage.buckets
  set file_size_limit = 52428800, -- 50 MB (video); images are capped at 10 MB in-app
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp',
                                 'video/mp4', 'video/quicktime', 'video/webm']
  where id = 'story-media';

-- The read/insert/delete policies on `storage.objects` are unchanged: media is
-- still keyed `<owner uuid>/<uuid>.<ext>`, still private, still gated by
-- `can_view_story_object`, and still immutable once stored.

  add constraint story_media_file_size_check
  check (file_size between 1 and 52428800);
