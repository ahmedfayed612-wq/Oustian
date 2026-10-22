-- ============================================================================
-- Chat security hardening: idempotency + immutable message relationships
-- ============================================================================
-- Adds an idempotency key to `messages` so clients can safely retry a send
-- without duplicating rows, and a trigger that makes `sender_id` and
-- `conversation_id` immutable after insert (a message can never be moved to
-- another conversation or reassigned to another sender).
--
-- Reversible: dropping the trigger/function and the column/index restores the
-- previous schema. No data is destroyed.
-- ============================================================================

-- 1. Idempotency key. Clients generate a UUID per send attempt; retries reuse
--    the same key. The unique index rejects duplicates so a replayed insert
--    fails deterministically instead of creating a second message.
alter table public.messages
  add column if not exists idempotency_key text;

create unique index if not exists messages_idempotency_key_idx
  on public.messages (idempotency_key)
  where idempotency_key is not null;

comment on column public.messages.idempotency_key is
  'Client-generated idempotency key for safe send retries. Unique when present.';

-- 2. Immutability guard. RLS already authenticates the sender, but nothing
--    stopped a compromised client from sending an UPDATE that retargets the
--    message at a different conversation (`conversation_id`) or reassigns it
--    (`sender_id`). This trigger makes both columns immutable after insert.
create or replace function public.guard_message_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conversation_id is distinct from old.conversation_id then
    raise exception 'message_conversation_immutable'
      using message = 'conversation_id cannot be changed after insert';
  end if;
  if new.sender_id is distinct from old.sender_id then
    raise exception 'message_sender_immutable'
      using message = 'sender_id cannot be changed after insert';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_immutable on public.messages;
create trigger messages_guard_immutable
  before update on public.messages
  for each row
  execute function public.guard_message_immutable();

comment on function public.guard_message_immutable() is
  'Prevents updates from changing conversation_id or sender_id on messages.';

-- 3. Privileges on the new function.
revoke execute on function public.guard_message_immutable() from public;
-- (security definer, used only by the trigger; no direct grants needed)

-- 4. RLS policy tightening. The update policy already requires sender_id =
--    auth.uid() in both `using` and `with check`; the trigger above adds the
--    immutability guarantee at the trigger layer so RLS alone cannot be
--    bypassed by a future policy change.
--    No grant changes needed: `grant update on public.messages to authenticated`
--    already exists from chat_v2.

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   drop trigger if exists messages_guard_immutable on public.messages;
--   drop function if exists public.guard_message_immutable();
--   drop index if exists public.messages_idempotency_key_idx;
--   alter table public.messages drop column if exists idempotency_key;
-- ---------------------------------------------------------------------------
