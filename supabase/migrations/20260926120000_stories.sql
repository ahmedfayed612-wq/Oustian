-- ============================================================================
-- Stories v1 — temporary photo stories for connections
--
-- A story is a photo with a 24-hour life, visible to the author's accepted
-- connections. This migration owns:
--
--   * `stories`       — one published story item (author, visibility, expiry)
--   * `story_media`   — the photo behind it, one row per image (same shape as
--                       `post_media`: key, mime, size, dimensions, caption)
--   * `story_views`   — who watched what, deduplicated by primary key
--
-- Expiry is a column, never a cron: `expires_at` defaults to now() + 24h and
-- every read filters on it (RLS included), so an expired story is invisible
-- the second it lapses with no scheduled job. `purge_expired_stories()` exists
-- for operators who want the rows (and their storage keys) reclaimed later —
-- it is never required for the product to behave correctly.
--
-- Visibility lives in the schema from day one (`connections` today, plus
-- `public`/`selected`/`private` reserved) so adding audiences later is data,
-- not a rebuild. V1 only ever writes `connections`.
--
-- Storage: private `story-media` bucket, object layout
-- `story-media/<user_id>/<uuid>.<ext>` — the same direct-from-the-browser
-- upload as post photos (bytes never traverse a Vercel function). Unlike post
-- media, story media is NOT readable by every approved member, so:
--   * the storage SELECT policy asks `can_view_story_object(name)`, which
--     resolves the object back to its story and applies story visibility. A
--     signed URL can therefore only ever be minted by someone allowed to see
--     that story — predictable paths are useless without permission.
--   * the app signs story media WITHOUT the shared signed-URL cache (see
--     `signedStoryMediaUrls`) because one member's URL must never be handed
--     to another.
--
-- Writes never come from the client: readers hold `select` grants only, and
-- every transition (publish, watch, delete) goes through a SECURITY DEFINER
-- function that derives identity from `auth.uid()`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- Reserved for later audiences: only `connections` is written in V1, and
  -- `public` is already honoured by the read rule below.
  visibility text not null default 'connections'
    check (visibility in ('connections', 'selected', 'public', 'private')),
  status text not null default 'active'
    check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  -- The single source of truth for "is this story still alive".
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz
);

comment on table public.stories is
  'One published story item. Expiry is data (`expires_at`), never a cron job. Writes only via create_story()/delete_story().';

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- `<own uuid>/<uuid>.<ext>` — built by the story composer's ticket action,
  -- never taken from input (same invariant as post_media).
  storage_key text not null unique
    check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$'),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size between 1 and 10485760), -- ≤ 10 MB
  width int not null check (width >= 200),
  height int not null check (height >= 200),
  -- Short text overlay for the photo (V1 supports a caption, not stickers).
  caption text check (caption is null or char_length(btrim(caption)) <= 280),
  display_order smallint not null default 0
    check (display_order >= 0 and display_order < 100),
  created_at timestamptz not null default now(),
  unique (story_id, display_order)
);

comment on table public.story_media is
  'Photo attached to a story (V1: one per story; the table allows a multi-photo story with no schema change).';

create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  -- One row per (story, viewer): re-opening a story never inflates the count.
  primary key (story_id, viewer_id)
);

comment on table public.story_views is
  'Who watched which story. The author is never recorded — their own view is not an audience. Writes only via view_story().';

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- The tray: every live story, newest first, bounded by the expiry horizon.
create index if not exists stories_active_idx
  on public.stories (created_at desc)
  where status = 'active';
-- Author rings (own profile, "next story from this person").
create index if not exists stories_author_idx
  on public.stories (author_id, created_at desc);
-- Expiry sweeps and the `expires_at > now()` filter every read applies.
create index if not exists stories_expires_idx
  on public.stories (expires_at);
create index if not exists story_media_story_idx
  on public.story_media (story_id, display_order);
create index if not exists story_media_key_idx
  on public.story_media (storage_key);
create index if not exists story_views_viewer_idx
  on public.story_views (viewer_id, story_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- True when `a` and `b` hold an accepted connection. SECURITY DEFINER so story
-- policies can ask without re-entering the `connections` policies.
create or replace function public.are_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.connections
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

comment on function public.are_connected(uuid, uuid) is
  'Accepted-connection check used by story visibility.';

-- Can the caller see this story? One rule, used by the row policy, the media
-- policy and the storage policy, so the three can never drift apart.
create or replace function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stories s
    where s.id = p_story
      and s.status = 'active'
      and s.deleted_at is null
      and (
        -- The author always sees their own story, expired or not: it is how
        -- they delete it and how they read their viewer list.
        s.author_id = auth.uid()
        or (
          public.is_approved_member()
          and s.expires_at > now()
          and (
            s.visibility = 'public'
            or (
              s.visibility = 'connections'
              and public.are_connected(s.author_id, auth.uid())
            )
            -- 'selected' / 'private' resolve to the author only in V1: the
            -- audience table ships with the feature that needs it.
          )
        )
      )
  );
$$;

comment on function public.can_view_story(uuid) is
  'Single story-visibility rule: author, or approved member inside the visibility audience and the expiry window.';

-- Storage-side twin of the above: resolve an object path back to its story.
create or replace function public.can_view_story_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.story_media m
    where m.storage_key = p_name
      and public.can_view_story(m.story_id)
  );
$$;

comment on function public.can_view_story_object(text) is
  'Storage read rule for story-media: an object is signable only while its story is visible to the caller.';

-- Owner check for the viewer list (named separately so it reads clearly).
create or replace function public.owns_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.stories
    where id = p_story and author_id = auth.uid()
  );
$$;

comment on function public.owns_story(uuid) is
  'True when the caller authored the story — gates the viewer list.';

-- ---------------------------------------------------------------------------
-- 4. Write paths (SECURITY DEFINER; clients hold no DML grants in section 6)
-- ---------------------------------------------------------------------------

-- Publish one story. Metadata arrives from the composer's upload, but the
-- bytes were already sniffed server-side by the action before this runs; the
-- bounds here are the database's own backstop (the create_post pattern).
-- Idempotent on storage_key: a retried publish (double tap, lost response)
-- returns the story that already exists instead of stacking a second one.
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
     or p_media_key !~ ('^' || v_me::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_media_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid_media' using errcode = 'check_violation';
  end if;

  if p_media_size is null or p_media_size < 1 or p_media_size > 10485760 then
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
  'Atomic story publish: story + photo in one transaction, idempotent per uploaded storage key.';

-- Record one watch. Deduplicated by the primary key, and the author's own
-- view is deliberately never stored: the count means "people reached".
-- Returns the current audience size so the UI can paint it in one round trip.
create or replace function public.view_story(p_story uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_author uuid;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  -- Visibility is re-checked here, not trusted from the caller: a guessed
  -- story id from someone else's audience records nothing.
  if not public.can_view_story(p_story) then
    raise exception 'invalid_story' using errcode = 'check_violation';
  end if;

  select author_id into v_author from public.stories where id = p_story;

  if v_author <> v_me then
    insert into public.story_views (story_id, viewer_id)
    values (p_story, v_me)
    on conflict (story_id, viewer_id) do nothing;
  end if;

  return (select count(*) from public.story_views where story_id = p_story);
end;
$$;

comment on function public.view_story(uuid) is
  'Idempotent watch: one row per (story, viewer), never one for the author. Returns the viewer count.';

-- Soft-delete the caller's own story (admins may remove any, for moderation).
-- Soft on purpose: the row disappearing from every read is what "deleted"
-- means to members, while the audit trail survives.
create or replace function public.delete_story(p_story uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  update public.stories
  set status = 'deleted', deleted_at = now()
  where id = p_story
    and (author_id = v_me or public.is_admin())
    and status = 'active';

  if not found then
    raise exception 'invalid_story' using errcode = 'check_violation';
  end if;

  return true;
end;
$$;

comment on function public.delete_story(uuid) is
  'Soft-deletes a story (author or admin); it disappears from the tray, the viewer and every profile immediately.';

-- Operator path, never required by the product: hard-deletes long-expired
-- stories and returns their storage keys so a cleanup job (or an admin in the
-- SQL editor) can reclaim the objects. Reads already ignore expired rows, so
-- this only ever shrinks storage.
create or replace function public.purge_expired_stories(p_older_than interval default '1 day')
returns table (storage_key text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  return query
    delete from public.stories s
    where s.expires_at < now() - p_older_than
    returning (
      select m.storage_key
      from public.story_media m
      where m.story_id = s.id
      order by m.display_order
      limit 1
    );
end;
$$;

comment on function public.purge_expired_stories(interval) is
  'Admin-only maintenance: removes stories expired longer than the given age and returns their storage keys. Never needed for correct behaviour.';

-- ---------------------------------------------------------------------------
-- 5. Storage: private `story-media` bucket (same shape as post-media)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  false, -- private: reads go through the visibility-aware policy below
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reads follow STORY visibility (not "any approved member"): someone who is
-- not connected to the author cannot get a signed URL for their story photo,
-- and an expired story stops being signable the moment it lapses.
drop policy if exists story_media_select on storage.objects;
create policy story_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'story-media'
    and public.can_view_story_object(name)
  );

-- Uploads only inside the caller's own folder — the ticket action builds the
-- key itself, so path traversal has nothing to grab onto.
drop policy if exists story_media_insert_own on storage.objects;
create policy story_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_member()
  );

-- No update policy: stored story media is immutable. Deletion is allowed for
-- the owner (failed-validation cleanup, purged stories) and for admins.
drop policy if exists story_media_delete_own on storage.objects;
create policy story_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'story-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Row Level Security: read-only tables, RPC-only writes
-- ---------------------------------------------------------------------------

alter table public.stories enable row level security;
alter table public.story_media enable row level security;
alter table public.story_views enable row level security;

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
  for select to authenticated
  using (public.can_view_story(id));

drop policy if exists story_media_rows_select on public.story_media;
create policy story_media_rows_select on public.story_media
  for select to authenticated
  using (public.can_view_story(story_id));

-- A viewer may confirm their own watch; only the author reads the audience.
drop policy if exists story_views_select on public.story_views;
create policy story_views_select on public.story_views
  for select to authenticated
  using (viewer_id = auth.uid() or public.owns_story(story_id));

revoke all on public.stories from anon, authenticated;
revoke all on public.story_media from anon, authenticated;
revoke all on public.story_views from anon, authenticated;

grant select on public.stories to authenticated;
grant select on public.story_media to authenticated;
grant select on public.story_views to authenticated;

revoke execute on function public.are_connected(uuid, uuid) from public;
grant execute on function public.are_connected(uuid, uuid) to authenticated;
revoke execute on function public.can_view_story(uuid) from public;
grant execute on function public.can_view_story(uuid) to authenticated;
revoke execute on function public.can_view_story_object(text) from public;
grant execute on function public.can_view_story_object(text) to authenticated;
revoke execute on function public.owns_story(uuid) from public;
grant execute on function public.owns_story(uuid) to authenticated;

revoke execute on function public.create_story(text, text, bigint, int, int, text) from public;
grant execute on function public.create_story(text, text, bigint, int, int, text) to authenticated;
revoke execute on function public.view_story(uuid) from public;
grant execute on function public.view_story(uuid) to authenticated;
revoke execute on function public.delete_story(uuid) from public;
grant execute on function public.delete_story(uuid) to authenticated;
revoke execute on function public.purge_expired_stories(interval) from public;
grant execute on function public.purge_expired_stories(interval) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Notifications: kind reserved, no rows generated
--
-- Stories must never notify per view, and V1 does not notify on publish either
-- (a new story is discovered in the tray — that is the tray's whole job). The
-- CHECK list is extended now only so shipping an opt-in "your connection
-- posted a story" trigger later is a pure SQL addition, with no constraint
-- change and — importantly — no notification spam today.
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('post_like', 'post_comment', 'connection_request',
                  'post_reaction', 'post_talk',
                  'comment_reaction', 'comment_talk',
                  'story_new'));






