-- ============================================================================
-- M5 — campus events and RSVPs
--
-- Any approved member can publish an event (title, optional description and
-- location, start time, optional end). RSVPs are one row per member per
-- event — the primary key dedupes and the button simply toggles it.
-- ============================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (description is null or char_length(btrim(description)) <= 2000),
  location text check (location is null or char_length(btrim(location)) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint events_window check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

comment on table public.events is
  'Campus events created by approved members.';
comment on table public.event_rsvps is
  'RSVP per member per event — the primary key dedupes.';

create index if not exists events_starts_idx
  on public.events (starts_at);
create index if not exists event_rsvps_user_idx
  on public.event_rsvps (user_id);

-- ---------------------------------------------------------------------------
-- 2. Triggers (identity + throttles)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.creator_id <> auth.uid() or not public.is_approved_member() then
    raise exception 'not_authorised';
  end if;

  if (
    select count(*)
    from public.events
    where creator_id = new.creator_id
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too_many_attempts';
  end if;

  return new;
end;
$$;

drop trigger if exists events_before_insert on public.events;
create trigger events_before_insert
  before insert on public.events
  for each row execute function public.handle_new_event();

create or replace function public.handle_new_rsvp()
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

drop trigger if exists event_rsvps_before_insert on public.event_rsvps;
create trigger event_rsvps_before_insert
  before insert on public.event_rsvps
  for each row execute function public.handle_new_rsvp();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert to authenticated
  with check (creator_id = auth.uid() and public.is_approved_member());

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (
    public.is_approved_member()
    and (creator_id = auth.uid() or public.is_admin())
  );

drop policy if exists event_rsvps_select on public.event_rsvps;
create policy event_rsvps_select on public.event_rsvps
  for select to authenticated
  using (public.is_approved_member());

drop policy if exists event_rsvps_insert_own on public.event_rsvps;
create policy event_rsvps_insert_own on public.event_rsvps
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved_member());

drop policy if exists event_rsvps_delete_own on public.event_rsvps;
create policy event_rsvps_delete_own on public.event_rsvps
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------------

revoke all on public.events from anon, authenticated;
revoke all on public.event_rsvps from anon, authenticated;

grant select, insert, delete on public.events to authenticated;
grant select, insert, delete on public.event_rsvps to authenticated;
