-- ============================================================================
-- M2/M4 — direct messages
--
-- Chat runs entirely through Supabase: the browser subscribes to the
-- `messages` table over Realtime and inserts through RLS-checked writes.
-- There is no socket server on Vercel (functions cannot hold state) — see the
-- Vercel deployment rules in the README.
--
--   * `conversations`            — one row per thread, bumped on every message
--   * `conversation_members`     — who is in a thread + their read cursor
--   * `messages`                 — plain text bodies (media chat is later)
--
-- Threads are created only by the `start_conversation()` RPC, which reuses the
-- existing 1:1 conversation instead of stacking duplicates.
-- ============================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.conversations is
  'Chat threads. Members are added only by start_conversation().';
comment on table public.conversation_members is
  'Thread membership + per-member read cursor (last_read_at drives unread counts).';
comment on table public.messages is
  'Chat messages. Inserted from the browser, guarded by RLS and a send throttle.';

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx
  on public.messages (sender_id);
create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id, conversation_id);
create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

-- ---------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------

-- Membership check used by every chat RLS policy. SECURITY DEFINER so policies
-- on `conversation_members` never re-enter themselves.
create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation
      and user_id = auth.uid()
  );
$$;

comment on function public.is_conversation_member(uuid) is
  'True when the caller belongs to the conversation. Used by chat RLS policies.';

-- Opens — or reuses — the 1:1 thread between the caller and `p_other`. Runs as
-- its owner so it can create the conversation and both membership rows
-- atomically; clients hold no insert grant on those tables.
create or replace function public.start_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_existing uuid;
  v_conversation uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_other is null or p_other = v_me then
    raise exception 'invalid_conversation';
  end if;

  -- Both ends must be approved members: nothing with pending, rejected or
  -- suspended accounts.
  if not exists (select 1 from public.profiles where id = v_me and status = 'approved')
     or not exists (select 1 from public.profiles where id = p_other and status = 'approved') then
    raise exception 'not_authorised';
  end if;

  -- Reuse an existing two-person thread instead of stacking duplicates.
  select c.id into v_existing
  from public.conversations c
  join public.conversation_members m on m.conversation_id = c.id
  where c.id in (
    select conversation_id from public.conversation_members where user_id = v_me
    intersect
    select conversation_id from public.conversation_members where user_id = p_other
  )
  group by c.id
  having count(*) = 2
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.conversations (id)
  values (gen_random_uuid())
  returning id into v_conversation;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation, v_me), (v_conversation, p_other);

  return v_conversation;
end;
$$;

comment on function public.start_conversation(uuid) is
  'Returns the existing 1:1 conversation with `p_other`, or creates it.';

-- One round trip for the inbox: every conversation the caller belongs to with
-- its peer, preview message and unread count, newest thread first.
create or replace function public.list_conversation_previews()
returns table (
  conversation_id uuid,
  last_read_at timestamptz,
  other_id uuid,
  other_username citext,
  other_full_name text,
  other_avatar_path text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cm.conversation_id,
    cm.last_read_at,
    peer.id,
    peer.username,
    peer.full_name,
    peer.avatar_path,
    last_msg.body,
    coalesce(last_msg.created_at, c.last_message_at),
    last_msg.sender_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = cm.conversation_id
        and m.sender_id <> cm.user_id
        and m.created_at > cm.last_read_at
    )
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = cm.conversation_id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  left join public.profiles peer
    on peer.id = (
      select cm2.user_id
      from public.conversation_members cm2
      where cm2.conversation_id = cm.conversation_id
        and cm2.user_id <> cm.user_id
      limit 1
    )
  where cm.user_id = auth.uid()
  order by coalesce(last_msg.created_at, c.last_message_at) desc;
$$;

comment on function public.list_conversation_previews() is
  'Inbox rows for the caller: peer profile, preview message, unread count.';

revoke execute on function public.list_conversation_previews() from public;
grant execute on function public.list_conversation_previews() to authenticated;

-- Freshness + abuse control, entirely in Postgres (serverless holds no memory):
-- re-checks membership and sender at insert time, throttles to 40 messages per
-- sender per minute, and bumps `conversations.last_message_at`.
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sender_id <> auth.uid()
     or not public.is_conversation_member(new.conversation_id) then
    raise exception 'not_authorised';
  end if;

  if (
    select count(*)
    from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '1 minute'
  ) >= 40 then
    raise exception 'too_many_attempts';
  end if;

  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.handle_new_message();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Deliberately no insert policy on `conversations` / `conversation_members`:
-- rows are created by `start_conversation()` only, and clients hold no insert
-- grant for these tables either.

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

-- Members see every row of their threads (their own cursor and the other
-- side's), nobody else sees anything.
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id));

-- Read receipts: each member advances only their own `last_read_at`.
drop policy if exists conversation_members_update_own on public.conversation_members;
create policy conversation_members_update_own on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

-- Retraction only: messages are never edited in place.
drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------

revoke all on public.conversations from anon, authenticated;
revoke all on public.conversation_members from anon, authenticated;
revoke all on public.messages from anon, authenticated;

grant select on public.conversations to authenticated;
grant select, update on public.conversation_members to authenticated;
grant insert, select, delete on public.messages to authenticated;

revoke execute on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;
revoke execute on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime — the browser subscribes straight to Supabase; there is no
--    socket server on Vercel (deployment rule: no long-running processes).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end;
$$;

-- Deletes (message retraction) must carry the full old row so Realtime can
-- re-evaluate RLS against it.
alter table public.messages replica identity full;
