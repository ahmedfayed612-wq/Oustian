-- ============================================================================
-- V2 — Canonical posting service
--
-- WHAT V2 FIXES (evidence from the legacy audit):
--   * `create_post()` was changed from a 7-parameter scalar signature
--     (migration 20261020000001_photo_thumbnails.sql) to a 10-parameter
--     function that ALSO expected three thumbnail columns on `post_media`.
--   * Migration 20261027000001_remove_thumbnail_columns.sql then dropped those
--     three columns, so the 10-arg function's `INSERT INTO post_media
--     (..., thumbnail_key, thumb_width, thumb_height)` raised "column does not
--     exist" -> every photo post failed at publish time.
--   * The frontend never caught up: `feed/queries.ts` and `feed/validation.ts`
--     still SELECTed / accepted the dropped thumbnail columns, and
--     `media/actions.ts` / `post-composer.tsx` still minted two signed upload
--     URLs plus a thumbnail key. A partial-fix commit restoring the 7-arg
--     function was committed to a branch but never merged into main.
--
-- V2 delivers ONE canonical publish path: `create_post(p_body, p_media)`, which
-- handles text-only, image-only, text+image, and multi-image posts in a single
-- atomic transaction. Every thumbnail duplicate is removed.
--
-- Applied on top of the live schema. No existing table is dropped or renamed:
-- `posts`, `post_media`, `post_reactions`, `comment_reactions`,
-- `post_comments`, `post_likes`, `notifications` and `profiles` are shared
-- resources, and deleting or renaming them would orphan data and break
-- comments, reactions, likes and notifications.
-- ============================================================================

-- --- 1. Remove any prior (broken / overloaded) create_post -------------------
drop function if exists public.create_post(text, text, text, text, text, text, text);
drop function if exists public.create_post(text, text, text, bigint, int, int, text, text, int, int);

-- --- 2. Schema hygiene: guarantee the storage layer is clean -----------------
-- Defensive: if a thumbnail-column removal was not applied before this V2
-- migration, drop the leftover columns now. Idempotent.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_media'
      and column_name in ('thumbnail_key', 'thumb_width', 'thumb_height')
  ) then
    alter table public.post_media
      drop column if exists thumbnail_key,
      drop column if exists thumb_width,
      drop column if exists thumb_height;
  end if;
end
$$;

-- --- 3. Canonical create_post ----------------------------------------------
-- A single, well-documented function is the one source of truth for all
-- publishing. It is SECURITY DEFINER: the author is read from the session JWT
-- (`auth.uid()`), never from the client, so a forged request can only ever
-- publish as the caller.
--
-- p_body : caption text. Optional (may be empty).
-- p_media: JSONB array. Each entry:
--   { "key": "<storage_key>", "mime": "image/jpeg|png|webp",
--     "size": bytes, "width": px, "height": px, "alt": "text" }
--   `key` must be `<owner_id>/<uuid>.<ext>` owned by the caller.
--
-- One call creates the post AND every media row in a single transaction, so a
-- photo can never be half-attached. Text-only posts (an empty array) and
-- image-only posts (no caption) are both legal.
--
-- Returns the new post id. Idempotency for retries is handled client-side:
-- the publish button is disabled for the duration of the server action, so a
-- single submit always performs exactly one insert.
create or replace function public.create_post(
  p_body text,
  p_media jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me      uuid := auth.uid();
  v_id      uuid;
  v_body    text := btrim(coalesce(p_body, ''));
  v_entry   jsonb;
  v_key     text;
  v_mime    text;
  v_size    bigint;
  v_width   int;
  v_height  int;
  v_alt     text;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if char_length(v_body) > 5000 then
    raise exception 'post_too_long' using errcode = 'check_violation';
  end if;

  -- Text-only posts: content must exist. Image-only is allowed (body empty).
  if p_media is null or jsonb_array_length(p_media) = 0 then
    if v_body = '' then
      raise exception 'empty_post' using errcode = 'check_violation';
    end if;

    insert into public.posts (id, author_id, body)
    values (gen_random_uuid(), v_me, v_body)
    returning id into v_id;

    return v_id;
  end if;

  -- Media posts: validate every entry BEFORE writing anything, so a bad image
  -- can never land a row the schema would reject (or a half-published post).
  for v_entry in
    select value from jsonb_array_elements(p_media)
  loop
    v_key    := trim(coalesce(v_entry ->> 'key', ''));
    v_mime   := trim(coalesce(v_entry ->> 'mime', ''));
    v_size   := coalesce(v_entry ->> 'size', NULL)::bigint;
    v_width  := coalesce(v_entry ->> 'width', NULL)::int;
    v_height := coalesce(v_entry ->> 'height', NULL)::int;
    v_alt    := nullif(btrim(coalesce(v_entry ->> 'alt', '')), '');

    if v_key = '' then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
    if v_size is null or v_size < 1 or v_size > 10485760 then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
    if v_width is null or v_width < 200 then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
    if v_height is null or v_height < 200 then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;

    -- Ownership: an image may only be attached by its owner.
    if split_part(v_key, '/', 1) <> v_me::text then
      raise exception 'invalid_media' using errcode = 'check_violation';
    end if;
  end loop;

  -- Insert the post (one row).
  insert into public.posts (id, author_id, body)
  values (gen_random_uuid(), v_me, v_body)
  returning id into v_id;

  -- Insert every media attachment in the same transaction.
  with entries as (
    select
      value,
      row_number() over () - 1 as idx
    from jsonb_array_elements(p_media)
  )
  insert into public.post_media (
    post_id, created_by, storage_key, mime_type,
    file_size, width, height, alt_text, display_order
  )
  select
    v_id,
    v_me,
    e.value ->> 'key',
    e.value ->> 'mime',
    (e.value ->> 'size')::bigint,
    (e.value ->> 'width')::int,
    (e.value ->> 'height')::int,
    nullif(btrim(coalesce(e.value ->> 'alt', '')), ''),
    e.idx
  from entries e;

  return v_id;
end;
$$;

comment on function public.create_post(text, jsonb) is
  'Canonical publish: text-only or multi-image post. Enforces content + media bounds; one atomic transaction; returns the new post id.';

revoke execute on function public.create_post(text, jsonb) from public;
grant execute on function public.create_post(text, jsonb) to authenticated;
