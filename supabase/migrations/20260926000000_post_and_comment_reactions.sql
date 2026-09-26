-- ============================================================================
-- Oustians Native Interaction System v1
--
-- Four reactions (fire / insight / same / talk) on posts AND comments, backed
-- by two normalised tables that mirror the existing `post_likes` pattern
-- (real foreign keys, real RLS, cascades on delete — no polymorphic
-- target_type column, because PostgREST/RLS work per-table and the feed reads
-- must stay cheap). One row per (target, member); changing a reaction is an
-- UPDATE, toggling off is a DELETE, toggling on is an INSERT.
--
-- All writes go through the idempotent `react_to_post()` / `react_to_comment()`
-- functions (SECURITY DEFINER, same pattern as `set_connection()`): the client
-- never writes these tables directly. The functions return the full result the
-- UI paints — user_reaction plus all four counts — in one round trip.
--
-- Existing data is preserved: every `post_likes` row is carried over as a
-- `fire` reaction inside this same migration.
-- ============================================================================

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'insight', 'same', 'talk')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'insight', 'same', 'talk')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

comment on table public.post_reactions is
  'Oustians reactions on posts: fire/insight/same/talk, one per member per post.';
comment on table public.comment_reactions is
  'Oustians reactions on comments: fire/insight/same/talk, one per member per comment.';

-- Indexes the reads actually need: (part 1) counting every reaction on a page
-- of targets, (part 2) the current viewer''s rows, (part 3) who reacted with
-- what when the reaction-user sheet opens.
create index if not exists post_reactions_target_idx
  on public.post_reactions (post_id, reaction);
create index if not exists post_reactions_user_idx
  on public.post_reactions (user_id);

create index if not exists comment_reactions_target_idx
  on public.comment_reactions (comment_id, reaction);
create index if not exists comment_reactions_user_idx
  on public.comment_reactions (user_id);

-- The old like becomes the new fire: one equivalent reaction per like, no
-- data loss, no duplicates (a liked post maps to exactly one fire row).
insert into public.post_reactions (post_id, user_id, reaction, created_at)
select post_id, user_id, 'fire', created_at
from public.post_likes
on conflict (post_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- react_to_post(p_post, p_reaction) / react_to_comment(p_comment, p_reaction)
--
-- The only way to write reactions. Empty `p_reaction` ('') asks the server to
-- clear the caller's reaction. Everything else must be one of the four
-- reactions, otherwise 'invalid_reaction'. A reaction on content the caller
-- cannot see is 'invalid_target'. Auth/approval failures are 'not_authorised'.
--
-- Returned JSON: { user_reaction, fire, insight, same, talk, total } — the
-- client paints from this and makes no follow-up request.
-- ---------------------------------------------------------------------------

create or replace function public.react_to_post(p_post uuid, p_reaction text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_author uuid;
  v_result jsonb;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if p_reaction is null
     or (p_reaction <> '' and p_reaction not in ('fire', 'insight', 'same', 'talk')) then
    raise exception 'invalid_reaction' using errcode = 'check_violation';
  end if;

  -- The caller must be allowed to see the post at all; deleted content has no
  -- row, so reacting to it is impossible here.
  select author_id into v_author
  from public.posts
  where id = p_post;

  if v_author is null or not public.is_approved_member() then
    raise exception 'invalid_target' using errcode = 'check_violation';
  end if;

  if p_reaction = '' then
    delete from public.post_reactions
    where post_id = p_post and user_id = v_me;
  else
    insert into public.post_reactions (post_id, user_id, reaction)
    values (p_post, v_me, p_reaction)
    on conflict (post_id, user_id) do update
      set reaction = excluded.reaction,
          updated_at = now();
  end if;

  select to_jsonb(row) into v_result
  from (
    select
      (select reaction from public.post_reactions
       where post_id = p_post and user_id = v_me) as user_reaction,
      count(*) filter (where reaction = 'fire') as fire,
      count(*) filter (where reaction = 'insight') as insight,
      count(*) filter (where reaction = 'same') as same,
      count(*) filter (where reaction = 'talk') as talk,
      count(*) as total
    from public.post_reactions
    where post_id = p_post
  ) row;

  return coalesce(v_result, '{"user_reaction":null,"fire":0,"insight":0,"same":0,"talk":0,"total":0}'::jsonb);
end;
$$;

create or replace function public.react_to_comment(p_comment uuid, p_reaction text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_row public.post_comments;
  v_result jsonb;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if p_reaction is null
     or (p_reaction <> '' and p_reaction not in ('fire', 'insight', 'same', 'talk')) then
    raise exception 'invalid_reaction' using errcode = 'check_violation';
  end if;

  -- Comments have no visibility of their own: they inherit the post's. If the
  -- post is gone, so is any reason to react.
  select * into v_row
  from public.post_comments
  where id = p_comment;

  if v_row.id is null then
    raise exception 'invalid_target' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.posts where id = v_row.post_id) then
    raise exception 'invalid_target' using errcode = 'check_violation';
  end if;

  if p_reaction = '' then
    delete from public.comment_reactions
    where comment_id = p_comment and user_id = v_me;
  else
    insert into public.comment_reactions (comment_id, user_id, reaction)
    values (p_comment, v_me, p_reaction)
    on conflict (comment_id, user_id) do update
      set reaction = excluded.reaction,
          updated_at = now();
  end if;

  select to_jsonb(row) into v_result
  from (
    select
      (select reaction from public.comment_reactions
       where comment_id = p_comment and user_id = v_me) as user_reaction,
      count(*) filter (where reaction = 'fire') as fire,
      count(*) filter (where reaction = 'insight') as insight,
      count(*) filter (where reaction = 'same') as same,
      count(*) filter (where reaction = 'talk') as talk,
      count(*) as total
    from public.comment_reactions
    where comment_id = p_comment
  ) row;

  return coalesce(v_result, '{"user_reaction":null,"fire":0,"insight":0,"same":0,"talk":0,"total":0}'::jsonb);
end;
$$;

comment on function public.react_to_post(uuid, text) is
  'Idempotent fire/insight/same/talk toggle-or-change for one post. Returns the painted state as JSON.';
comment on function public.react_to_comment(uuid, text) is
  'Idempotent fire/insight/same/talk toggle-or-change for one comment. Returns the painted state as JSON.';

revoke execute on function public.react_to_post(uuid, text) from public;
grant execute on function public.react_to_post(uuid, text) to authenticated;
revoke execute on function public.react_to_comment(uuid, text) from public;
grant execute on function public.react_to_comment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Aggregated, self-reverting reaction notifications.
--
-- One notification per (recipient, actor, type): reacting again only bumps
-- the count, removing the last reaction deletes the row. The inbox renders
-- "Ahmed and 14 others ..." from actor + count, Talk reactions get their own
-- (slightly more prominent) type, and nobody is ever notified about their own
-- reaction. Likes keep flowing through the untouched `handle_feed_interaction()`
-- on `post_likes`, so the old notification history stays exactly as it was.
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('post_like', 'post_comment', 'connection_request',
                  'post_reaction', 'post_talk',
                  'comment_reaction', 'comment_talk'));

alter table public.notifications
  add column if not exists reaction_count integer not null default 1
  check (reaction_count >= 1);

create index if not exists notifications_reaction_actor_idx
  on public.notifications (recipient_id, actor_id, type)
  where actor_id is not null
    and type in ('post_reaction', 'post_talk', 'comment_reaction', 'comment_talk');

-- Recomputes one aggregated notification after any reaction write: counts
-- current rows of the matching kind for (recipient, actor), inserts or bumps
-- the row when at least one remains, deletes it when none do.
create or replace function public.maintain_reaction_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_post uuid,
  p_table text,
  p_target uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;

  if p_table = 'post_reactions' then
    select count(*) into v_count
    from public.post_reactions
    where post_id = p_target and user_id = p_actor
      and ((p_type like '%\_talk') = (reaction = 'talk'));
  else
    select count(*) into v_count
    from public.comment_reactions
    where comment_id = p_target and user_id = p_actor
      and ((p_type like '%\_talk') = (reaction = 'talk'));
  end if;

  if v_count > 0 then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, reaction_count)
    values (p_recipient, p_actor, p_type, p_post, v_count)
    on conflict (recipient_id, actor_id, type)
    do update set reaction_count = excluded.reaction_count,
                  created_at = now(),
                  read_at = null;
  else
    delete from public.notifications
    where recipient_id = p_recipient
      and actor_id = p_actor
      and type = p_type;
  end if;
end;
$$;

-- A member's one row per target is the aggregation key: bumping it bumps the
-- notification, removing it clears the notification.
create unique index if not exists notifications_reaction_actor_uniq
  on public.notifications (recipient_id, actor_id, type)
  where actor_id is not null
    and type in ('post_reaction', 'post_talk', 'comment_reaction', 'comment_talk');

-- Re-runs the aggregation after a reaction row changes, mapping the write to
-- its notification: the post's author for post reactions, the comment's
-- author for comment reactions, and a Talk flavour when the row is a talk.
create or replace function public.after_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid := coalesce(new.post_id, old.post_id);
  v_actor uuid := coalesce(new.user_id, old.user_id);
  v_reaction text := coalesce(new.reaction, old.reaction);
  v_author uuid;
begin
  select author_id into v_author
  from public.posts
  where id = v_target;

  perform public.maintain_reaction_notification(
    v_author,
    v_actor,
    case when v_reaction = 'talk' then 'post_talk' else 'post_reaction' end,
    v_target,
    'post_reactions',
    v_target
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists post_reactions_after_write on public.post_reactions;
create trigger post_reactions_after_write
  after insert or update of reaction or delete on public.post_reactions
  for each row execute function public.after_post_reaction();

create or replace function public.after_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid := coalesce(new.comment_id, old.comment_id);
  v_actor uuid := coalesce(new.user_id, old.user_id);
  v_reaction text := coalesce(new.reaction, old.reaction);
  v_post uuid;
  v_author uuid;
begin
  select post_id, author_id into v_post, v_author
  from public.post_comments
  where id = v_target;

  perform public.maintain_reaction_notification(
    v_author,
    v_actor,
    case when v_reaction = 'talk' then 'comment_talk' else 'comment_reaction' end,
    v_post,
    'comment_reactions',
    v_target
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists comment_reactions_after_write on public.comment_reactions;
create trigger comment_reactions_after_write
  after insert or update of reaction or delete on public.comment_reactions
  for each row execute function public.after_comment_reaction();

-- ---------------------------------------------------------------------------
-- Row Level Security: approved members read reactions (counts must be public
-- for counts to render); nobody writes directly — only the two RPCs do, as
-- definer. Deletion cascades through the foreign keys, so removed content
-- takes its reactions with it and no orphans can exist.
-- ---------------------------------------------------------------------------

alter table public.post_reactions enable row level security;
alter table public.comment_reactions enable row level security;

drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists comment_reactions_select on public.comment_reactions;
create policy comment_reactions_select on public.comment_reactions
  for select to authenticated
  using (public.is_approved_member());

revoke all on public.post_reactions from anon, authenticated;
grant select on public.post_reactions to authenticated;
revoke all on public.comment_reactions from anon, authenticated;
grant select on public.comment_reactions to authenticated;



