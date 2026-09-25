-- ============================================================================
-- Connections (LinkedIn-style invites) + one level of comment replies
--
-- Two additions in one milestone:
--
--  1. `connections` — a directed request (requester → addressee) that becomes
--     an accepted connection. The unordered pair is unique, so two members can
--     never hold two rows between them regardless of direction. Clients never
--     write this table: every transition goes through the idempotent
--     `set_connection()` function (SECURITY DEFINER), which validates both
--     members and serialises the pair with `FOR UPDATE` — the same pattern as
--     `start_conversation()` in chat.
--
--  2. `post_comments.parent_id` — replies nest exactly one level deep. The
--     insert trigger validates that the parent belongs to the same post and
--     flattens replies-to-replies onto the top-level comment, so the UI can
--     group by `parent_id` without recursion.
-- ============================================================================

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

comment on table public.connections is
  'Connection requests between members: pending until accepted. Writes only via set_connection().';

-- One row per member pair, whichever direction it was created from. The
-- unique index is what makes a race between both members clicking "Connect"
-- resolve to a single row instead of two.
create unique index if not exists connections_pair_uniq
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists connections_addressee_idx
  on public.connections (addressee_id, status);
create index if not exists connections_requester_idx
  on public.connections (requester_id, status);

-- Replies: parent lookup for grouping + fast "roots of a post" reads.
alter table public.post_comments
  add column if not exists parent_id uuid
    references public.post_comments (id) on delete cascade;

create index if not exists post_comments_parent_idx
  on public.post_comments (post_id, parent_id, created_at);

-- ---------------------------------------------------------------------------
-- set_connection(other, action) -> resulting viewer state
--
-- Returns one of: 'none' | 'outgoing' | 'incoming' | 'connected'.
-- Errors are raised with messages the client maps to i18n codes:
-- not_authorised, invalid_profile, invalid_action.
-- ---------------------------------------------------------------------------

create or replace function public.set_connection(p_other uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_row public.connections;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if p_other is null or p_other = v_me then
    raise exception 'invalid_profile' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_other and status = 'approved'
  ) then
    raise exception 'invalid_profile' using errcode = 'check_violation';
  end if;

  if p_action not in ('request', 'accept', 'decline', 'cancel', 'disconnect') then
    raise exception 'invalid_action' using errcode = 'check_violation';
  end if;

  select * into v_row
  from public.connections
  where least(requester_id, addressee_id) = least(v_me, p_other)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_other)
  for update;

  if p_action = 'request' then
    if v_row.id is null then
      insert into public.connections (requester_id, addressee_id)
      values (v_me, p_other);
      return 'outgoing';
    end if;

    if v_row.status = 'accepted' then
      return 'connected';
    end if;

    if v_row.requester_id = v_me then
      return 'outgoing';
    end if;

    -- They asked first — one tap from either side connects the pair.
    update public.connections
    set status = 'accepted', responded_at = now()
    where id = v_row.id;

    return 'connected';
  end if;

  if p_action = 'accept' then
    if v_row.id is not null and v_row.requester_id <> v_me and v_row.status = 'pending' then
      update public.connections
      set status = 'accepted', responded_at = now()
      where id = v_row.id;
      return 'connected';
    end if;

    raise exception 'invalid_action' using errcode = 'check_violation';
  end if;

  if p_action = 'decline' then
    if v_row.id is not null and v_row.requester_id <> v_me and v_row.status = 'pending' then
      delete from public.connections where id = v_row.id;
      return 'none';
    end if;

    raise exception 'invalid_action' using errcode = 'check_violation';
  end if;

  if p_action = 'cancel' then
    if v_row.id is not null and v_row.requester_id = v_me and v_row.status = 'pending' then
      delete from public.connections where id = v_row.id;
      return 'none';
    end if;

    raise exception 'invalid_action' using errcode = 'check_violation';
  end if;

  -- disconnect
  if v_row.id is not null and v_row.status = 'accepted' then
    delete from public.connections where id = v_row.id;
    return 'none';
  end if;

  raise exception 'invalid_action' using errcode = 'check_violation';
end;
$$;

comment on function public.set_connection(uuid, text) is
  'Idempotent connection state machine for the caller: request/accept/decline/cancel/disconnect.';

revoke execute on function public.set_connection(uuid, text) from public;
grant execute on function public.set_connection(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Comment replies: same-post validation + flattening (one nesting level).
-- ---------------------------------------------------------------------------

create or replace function public.ensure_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent public.post_comments;
begin
  if new.parent_id is null then
    return new;
  end if;

  select * into v_parent from public.post_comments where id = new.parent_id;

  if v_parent.id is null or v_parent.post_id <> new.post_id then
    raise exception 'invalid_parent'
      using errcode = 'check_violation',
            hint = 'The parent comment must belong to the same post.';
  end if;

  -- One level of nesting only: a reply to a reply attaches to the thread root.
  if v_parent.parent_id is not null then
    new.parent_id := v_parent.parent_id;
  end if;

  return new;
end;
$$;

drop trigger if exists post_comments_before_insert on public.post_comments;
create trigger post_comments_before_insert
  before insert on public.post_comments
  for each row execute function public.ensure_comment_parent();

-- ---------------------------------------------------------------------------
-- Connection requests surface in the existing notification inbox.
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('post_like', 'post_comment', 'connection_request'));

-- Fires only when a pending row is created; accepting is an UPDATE on the
-- same row, so nobody gets a second notification for the same request.
create or replace function public.handle_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.addressee_id, new.requester_id, 'connection_request');

  return new;
end;
$$;

drop trigger if exists connections_after_insert on public.connections;
create trigger connections_after_insert
  after insert on public.connections
  for each row execute function public.handle_connection_request();

-- ---------------------------------------------------------------------------
-- Row Level Security: approved members read pairs (for counts and viewer
-- state); nobody writes directly — only set_connection() does, as definer.
-- ---------------------------------------------------------------------------

alter table public.connections enable row level security;

drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections
  for select to authenticated
  using (public.is_approved_member());

revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;


