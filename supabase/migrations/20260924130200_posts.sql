-- ============================================================================
-- M3 — posts, likes and comments
--
-- The feed is text-first: every approved member can publish up to 5,000
-- characters to campus, like what they read and comment inline. Media posts
-- arrive with their own milestone (browser → Supabase Storage, same pattern
-- as avatars — nothing ever uploads through Vercel).
--
-- Everything runs through RLS: pending/rejected/suspended accounts read
-- nothing, authors can only write as themselves, and posting/commenting are
-- throttled inside Postgres (serverless functions hold no memory).
-- ============================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

comment on table public.posts is
  'Campus-wide feed posts. Text-first; media lands with its own milestone.';
comment on table public.post_likes is
  'One like per member per post — the primary key is the dedupe.';
comment on table public.post_comments is
  'Inline comments on posts.';

create index if not exists posts_created_idx
  on public.posts (created_at desc);
create index if not exists posts_author_idx
  on public.posts (author_id, created_at desc);
create index if not exists post_likes_user_idx
  on public.post_likes (user_id);
create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- True when the caller (or the passed user) is an approved member. SECURITY
-- DEFINER so per-row feed policies never re-enter the `profiles` policies.
create or replace function public.is_approved_member(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user
      and status = 'approved'
  );
$$;

comment on function public.is_approved_member(uuid) is
  'Approved members only — gates every feed read and write.';

-- ---------------------------------------------------------------------------
-- 3. Triggers (identity + throttles)
-- ---------------------------------------------------------------------------

-- Comments are written straight from the browser through RLS, so the rate
-- limit lives here: at most 30 comments per author per 10 minutes.
create or replace function public.handle_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.author_id <> auth.uid() or not public.is_approved_member() then
    raise exception 'not_authorised';
  end if;

  if (
    select count(*)
    from public.post_comments
    where author_id = new.author_id
      and created_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'too_many_attempts';
  end if;

  return new;
end;
$$;

drop trigger if exists post_comments_before_insert on public.post_comments;
create trigger post_comments_before_insert
  before insert on public.post_comments
  for each row execute function public.handle_new_comment();

-- Likes: identity re-checked at insert time (the PK already dedupes).
create or replace function public.handle_new_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id <> auth.uid() or not public.is_approved_member() then
    raise exception 'not_authorised';
  end if;

  return new;
end;
$$;

drop trigger if exists post_likes_before_insert on public.post_likes;
create trigger post_likes_before_insert
  before insert on public.post_likes
  for each row execute function public.handle_new_like();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

-- posts ----------------------------------------------------------------------
-- The whole feed is campus-only: every policy first proves the caller is an
-- approved member, then applies the row-level rule.

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_approved_member()
  );

-- Authors can remove their own posts; admins moderate.
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (
    public.is_approved_member()
    and (author_id = auth.uid() or public.is_admin())
  );

-- post_likes -----------------------------------------------------------------

drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved_member());

drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- post_comments --------------------------------------------------------------

drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_approved_member()
  );

drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete to authenticated
  using (
    public.is_approved_member()
    and (author_id = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------

revoke all on public.posts from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;
revoke all on public.post_comments from anon, authenticated;

grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, delete on public.post_comments to authenticated;

revoke execute on function public.is_approved_member(uuid) from public;
grant execute on function public.is_approved_member(uuid) to authenticated;
