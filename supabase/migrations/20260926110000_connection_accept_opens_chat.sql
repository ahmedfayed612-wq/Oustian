-- ============================================================================
-- Connections: auto-open a 1:1 chat thread on accept
--
-- When a connection row flips pending -> accepted, members expect the pair
-- to appear in Messages immediately — without tapping Message first. The
-- trigger below inserts the shared conversation row + both membership rows
-- idempotently: `set_connection()` can only ever transition one pair row to
-- accepted once, and the guard re-checks for an existing two-person thread
-- before inserting, so retries and reversed accepts never stack duplicates.
--
-- Writes stay inside Postgres (SECURITY DEFINER) because clients hold no
-- insert grant on `conversations` / `conversation_members` — threads are
-- created by `start_conversation()` or this trigger only.
-- ============================================================================

create or replace function public.ensure_connection_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_conversation uuid;
begin
  -- Only the acceptance transition matters: pending -> accepted.
  if old.status = 'accepted' or new.status <> 'accepted' then
    return new;
  end if;

  -- Reuse an existing two-person thread instead of stacking duplicates
  -- (same shape as `start_conversation()`).
  select c.id into v_existing
  from public.conversations c
  join public.conversation_members m on m.conversation_id = c.id
  where c.id in (
    select conversation_id from public.conversation_members where user_id = new.requester_id
    intersect
    select conversation_id from public.conversation_members where user_id = new.addressee_id
  )
  group by c.id
  having count(*) = 2
  limit 1;

  if v_existing is not null then
    return new;
  end if;

  insert into public.conversations (id)
  values (gen_random_uuid())
  returning id into v_conversation;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation, new.requester_id), (v_conversation, new.addressee_id)
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.ensure_connection_conversation() is
  'Opens the 1:1 chat thread the moment a connection is accepted (idempotent).';

drop trigger if exists connections_ensure_conversation on public.connections;
create trigger connections_ensure_conversation
  after update of status on public.connections
  for each row execute function public.ensure_connection_conversation();
