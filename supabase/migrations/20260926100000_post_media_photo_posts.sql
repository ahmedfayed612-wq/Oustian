-- ============================================================================
-- Photo posts & rich media feed v1
--
-- A photo is just another Oustians post: same reactions, comments,
-- notifications and ranking. What is new is the storage model, built so the
-- database never needs redesigning for galleries:
--
--   posts ──< post_media (display_order) ──> one row per attached photo
--
-- V1's composer attaches exactly one photo, but nothing in the schema
-- assumes that: `post_media` carries per-photo metadata (key, mime, size,
-- dimensions, alt text) and a unique (post_id, display_order), so Post A →
-- image 1..4 later is just more rows. Keeping the metadata on the
-- attachment row (instead of a separate `media` table) means the feed reads
-- every photo of a page of posts in ONE batched query with no join, which
-- matches how this codebase already hydrates authors, likes and comments.
--
-- Storage: private `post-media` bucket, object layout `post-media/<user_id>/<uuid>.<ext>`,
-- browser → Storage direct (the avatars pattern — bytes never traverse a
-- Vercel function, whose request bodies are capped at ~4.5 MB), enforced by
-- bucket file-size/mime limits plus RLS folder checks. The publish action
-- downloads the stored object back and sniffs its real bytes before any
-- database row exists, so client-supplied type/size/dimensions are never
-- trusted. Photos inherit the post's visibility exactly: reads require
-- approved membership, same as `posts_select`.
--
-- `posts.body` stays NOT NULL but may now be empty — a photo-only post has
-- no caption. The "text or photo" content rule lives in `create_post()`,
-- the single write path the app uses, alongside the length bound.
-- ============================================================================

-- 1. Empty captions become legal (photo-only posts). The upper bound stays.
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts
  add constraint posts_body_check check (char_length(btrim(body)) <= 5000);

-- 2. One row per photo attached to a post.
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- Path inside the bucket. Shape-checked: `<own uuid>/<uuid>.<ext>` — the
  -- publish action builds this string itself, it is never taken from input.
  storage_key text not null unique
    check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size between 1 and 10485760), -- ≤ 10 MB
  width int not null check (width >= 200),
  height int not null check (height >= 200),
  alt_text text check (alt_text is null or char_length(btrim(alt_text)) <= 425),
  display_order smallint not null default 0
    check (display_order >= 0 and display_order < 100),
  created_at timestamptz not null default now(),
  unique (post_id, display_order)
);

comment on table public.post_media is
  'Photos attached to posts, one row per image (V1: one per post). Carries the media metadata so galleries need no schema change.';

-- The feed's hot path: every photo for a page of posts, batched by post.
create index if not exists post_media_post_idx
  on public.post_media (post_id, display_order);
create index if not exists post_media_creator_idx
  on public.post_media (created_by);

-- ---------------------------------------------------------------------------
-- create_post(body, media…) → post id
--
-- The single write path the app uses (the same SECURITY DEFINER pattern as
-- set_connection/react_to_*). It makes post + attachment one atomic
-- transaction — a photo can never be half-attached — and is idempotent on
-- storage_key: a retried publish (double click, lost response) returns the
-- post that already owns the upload instead of creating a second one.
-- ---------------------------------------------------------------------------

create or replace function public.create_post(
  p_body text,
  p_media_key text default null,
  p_media_mime text default null,
  p_media_size bigint default null,
  p_media_width int default null,
  p_media_height int default null,
  p_media_alt text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
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

  -- Photo post: metadata must be complete and sane. The publish action
  -- sniffed the actual bytes; these bounds mirror the table checks so a
  -- bad call can never write a row the schema would reject anyway.
  if p_media_mime is null
     or p_media_mime not in ('image/jpeg', 'image/png', 'image/webp')
     or p_media_size is null or p_media_size not between 1 and 10485760
     or p_media_width is null or p_media_width < 200
     or p_media_height is null or p_media_height < 200 then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  -- The object must live in the caller's own folder (uploads are RLS-bound
  -- to it; this closes the gap for a caller passing someone else's key).
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

comment on function public.create_post(text, text, text, bigint, int, int, text) is
  'Atomic publish: text post or photo post. Enforces the content rule and media bounds; idempotent per uploaded storage key.';

revoke execute on function public.create_post(text, text, text, bigint, int, int, text) from public;
grant execute on function public.create_post(text, text, text, bigint, int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage: private `post-media` bucket (same shape as the avatars bucket)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false, -- private: every read goes through a signed URL + the policy below
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reads follow post visibility: photo posts are visible to approved members,
-- so their images are too — a pending/rejected member sees neither.
drop policy if exists post_media_select on storage.objects;
create policy post_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'post-media' and public.is_approved_member());

-- Uploads only inside the caller's own folder (the publish action builds the
-- key itself; this makes any traversal impossible at the storage layer).
drop policy if exists post_media_insert_own on storage.objects;
create policy post_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_member()
  );

-- No update policy at all: stored media is immutable in V1 (replacement is a
-- future improvement — never an in-place rewrite).
drop policy if exists post_media_delete_own on storage.objects;
create policy post_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin() -- moderation: deleting a post must free its bytes
    )
  );

-- ---------------------------------------------------------------------------
-- 4. RLS on post_media: approved members read attachments (the feed renders
-- them); nobody writes directly — only create_post() does, as definer.
-- ---------------------------------------------------------------------------

alter table public.post_media enable row level security;

drop policy if exists post_media_rows_select on public.post_media;
create policy post_media_rows_select on public.post_media
  for select to authenticated
  using (public.is_approved_member());

revoke all on public.post_media from anon, authenticated;
grant select on public.post_media to authenticated;


