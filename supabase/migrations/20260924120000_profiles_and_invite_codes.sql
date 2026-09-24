-- ============================================================================
-- M1 — accounts, profiles, invite codes and rate limiting
--
-- Oustians is campus-only: every account is created with an invite code and
-- lands in `pending` until an admin approves it. This migration owns:
--
--   * the two account enums (status, role)
--   * `invite_codes` (+ the audit table `invite_code_uses`)
--   * `profiles` (1:1 with auth.users)
--   * `rate_limits`, the Postgres-backed counter used instead of in-memory
--     state (serverless functions cannot be trusted to keep any)
--   * the invite-gated signup trigger, privilege-escalation guards and RLS
--
-- Run it with `supabase db push` (see README → Deploy to Vercel). It is written
-- to be re-runnable-ish for local resets, but always apply it through the CLI.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions and enums
-- ---------------------------------------------------------------------------

-- usernames are compared case-insensitively
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum (
      'pending',   -- signed up, waiting for an admin
      'approved',  -- full access
      'rejected',  -- declined by an admin
      'suspended'  -- was approved, access revoked
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'account_role') then
    create type public.account_role as enum ('student', 'admin');
  end if;

  -- Extension point: how an account proved it belongs to campus. Only
  -- `invite_code` is produced today; the extra values exist so a later
  -- milestone can add university-email verification without a data migration.
  if not exists (select 1 from pg_type where typname = 'verification_method') then
    create type public.verification_method as enum (
      'invite_code',
      'university_email',
      'admin_invite',
      'manual'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Invite codes are created by admins and consumed exactly once by default.
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{3,31}$'),
  label text check (char_length(label) <= 80),
  max_uses integer not null default 1 check (max_uses between 1 and 500),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_codes_uses_within_max check (uses <= max_uses)
);

comment on table public.invite_codes is
  'Single-use (or N-use) campus invite codes. Consumed inside the signup trigger.';

-- Audit trail: who redeemed which code, so a leaked code can be traced.
create table if not exists public.invite_code_uses (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now(),
  unique (invite_code_id, user_id)
);

-- One profile per auth user. `status` gates the whole app.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  full_name text not null
    check (char_length(btrim(full_name)) between 2 and 80),
  faculty text check (char_length(faculty) <= 80),
  graduation_year smallint check (graduation_year between 2000 and 2100),
  bio text check (char_length(bio) <= 280),
  -- Supabase Storage object paths (bucket `avatars`), never public URLs
  avatar_path text,
  cover_path text,
  language text not null default 'en' check (language in ('en', 'ar')),
  status public.account_status not null default 'pending',
  role public.account_role not null default 'student',
  verification_method public.verification_method not null default 'invite_code',
  invite_code_id uuid references public.invite_codes (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  rejection_reason text check (char_length(rejection_reason) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Student profiles. `status` = approved is required before any app route works.';

create index if not exists profiles_status_idx
  on public.profiles (status, created_at desc);
create index if not exists profiles_full_name_idx
  on public.profiles (lower(full_name));
create index if not exists invite_codes_active_idx
  on public.invite_codes (is_active, expires_at);

-- Fixed-window counters. Keys are hashed before they get here (IP + email), so
-- no raw identifiers are stored. One row per bucket/key/window.
create table if not exists public.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket, key, window_start)
);

comment on table public.rate_limits is
  'Postgres-backed rate limiting: serverless functions hold no memory between requests.';

-- ---------------------------------------------------------------------------
-- 3. Helper functions
-- ---------------------------------------------------------------------------

-- True when the caller (or the passed user) is an approved admin. SECURITY
-- DEFINER so the check never re-enters the `profiles` policies.
create or replace function public.is_admin(p_user uuid default auth.uid())
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
      and role = 'admin'
      and status = 'approved'
  );
$$;

comment on function public.is_admin(uuid) is
  'Approved admins only — used by every admin RLS policy and the approval screens.';

-- Keeps updated_at honest without trusting the client.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fixed-window rate limiter: true while the caller is still under the limit.
-- Called from server actions (see `src/lib/rate-limit.ts`). The counter lives in
-- Postgres because serverless functions share no memory between requests.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_window interval,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_seconds double precision := greatest(extract(epoch from p_window), 1);
  v_window_start timestamptz;
  v_hits integer;
begin
  -- Nothing to key on (e.g. a local request with no IP header): never block.
  if p_key is null or p_key = '' then
    return true;
  end if;

  if p_max <= 0 then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );

  insert into public.rate_limits (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Cheap housekeeping so the table cannot grow forever.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

comment on function public.consume_rate_limit(text, text, interval, integer) is
  'Fixed-window limiter used by the auth server actions. False = over the limit.';

-- Lets the signup form say "invalid code" before a user is created. Read-only,
-- anonymous-friendly, and cheap to rate limit at the call site.
create or replace function public.is_invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.invite_codes
    where code = upper(btrim(p_code))
      and is_active
      and uses < max_uses
      and (expires_at is null or expires_at > now())
  );
$$;

-- Invite-gated signup. Runs inside the auth.users insert transaction, so an
-- invalid or exhausted code aborts the whole signup: no orphan auth user, and
-- the code is only consumed when everything else succeeds.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(btrim(coalesce(v_meta ->> 'invite_code', '')));
  v_username text := lower(btrim(coalesce(v_meta ->> 'username', '')));
  v_full_name text := btrim(coalesce(v_meta ->> 'full_name', ''));
  v_faculty text := nullif(btrim(coalesce(v_meta ->> 'faculty', '')), '');
  v_year_text text := nullif(btrim(coalesce(v_meta ->> 'graduation_year', '')), '');
  v_year smallint;
  v_language text := case when v_meta ->> 'language' = 'ar' then 'ar' else 'en' end;
  v_invite public.invite_codes;
begin
  if v_year_text is not null then
    v_year := v_year_text::smallint;
  end if;

  -- `for update` serialises two signups racing for the last use of a code.
  select *
  into v_invite
  from public.invite_codes
  where code = v_code
    and is_active
  for update;

  if not found then
    raise exception 'invite_code_invalid'
      using errcode = 'check_violation',
            hint = 'The invite code is not recognised.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite_code_expired'
      using errcode = 'check_violation',
            hint = 'The invite code has expired.';
  end if;

  if v_invite.uses >= v_invite.max_uses then
    raise exception 'invite_code_exhausted'
      using errcode = 'check_violation',
            hint = 'This invite code has already been used the maximum number of times.';
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'username_invalid'
      using errcode = 'check_violation',
            hint = 'Usernames are 3-24 characters: a-z, 0-9 and underscore.';
  end if;

  if exists (select 1 from public.profiles where username = v_username) then
    raise exception 'username_taken'
      using errcode = 'unique_violation',
            hint = 'That username is already taken.';
  end if;

  insert into public.profiles (
    id,
    username,
    full_name,
    faculty,
    graduation_year,
    language,
    status,
    role,
    verification_method,
    invite_code_id
  )
  values (
    new.id,
    v_username,
    v_full_name,
    v_faculty,
    v_year,
    v_language,
    'pending',
    'student',
    'invite_code',
    v_invite.id
  );

  update public.invite_codes
  set uses = uses + 1
  where id = v_invite.id;

  insert into public.invite_code_uses (invite_code_id, user_id)
  values (v_invite.id, new.id);

  return new;
end;
$$;

-- Approval and role columns are admin-only: a student edits their own profile
-- but can never approve themselves or promote themselves to admin.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- The dashboard, migrations, the service key and auth internals bypass it.
  if current_user in (
    'postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin'
  ) then
    return new;
  end if;

  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.role is distinct from old.role
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.rejection_reason is distinct from old.rejection_reason
    or new.invite_code_id is distinct from old.invite_code_id
    or new.verification_method is distinct from old.verification_method
  then
    raise exception 'profile_field_protected'
      using errcode = 'insufficient_privilege',
            hint = 'Only an admin can change approval, role or verification fields.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists invite_codes_touch_updated_at on public.invite_codes;
create trigger invite_codes_touch_updated_at
  before update on public.invite_codes
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_code_uses enable row level security;
alter table public.rate_limits enable row level security;

-- `rate_limits` deliberately has no policies: only the SECURITY DEFINER
-- function may read or write it, so no client can inflate or reset a counter.

-- profiles ------------------------------------------------------------------
-- Everyone reads their own row (this is what the pending screen uses) plus,
-- once signed in, the approved members. Unapproved accounts see nobody.

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_approved on public.profiles;
create policy profiles_select_approved on public.profiles
  for select to authenticated
  using (status = 'approved');

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert or delete policy on purpose: rows are created by the signup
-- trigger and removed by deleting the auth user.

-- invite_codes --------------------------------------------------------------
-- Admins manage codes; nobody else can even read them.

drop policy if exists invite_codes_admin_all on public.invite_codes;
create policy invite_codes_admin_all on public.invite_codes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists invite_code_uses_admin_select on public.invite_code_uses;
create policy invite_code_uses_admin_select on public.invite_code_uses
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.invite_codes to authenticated;
grant select on public.invite_code_uses to authenticated;

-- Rate limiting is executed by anonymous callers (signup, login), so the
-- function is granted but the table behind it is not.
revoke all on public.rate_limits from anon, authenticated;
revoke execute on function public.consume_rate_limit(text, text, interval, integer) from public;
grant execute on function public.consume_rate_limit(text, text, interval, integer) to anon, authenticated;
revoke execute on function public.is_invite_code_valid(text) from public;
grant execute on function public.is_invite_code_valid(text) to anon, authenticated;
revoke execute on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- The signup trigger runs as the auth server's role; grant it explicitly when
-- that role exists (it does on hosted Supabase, not in plain Postgres).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Bootstrap (run once, in the SQL editor, after your own account exists)
-- ---------------------------------------------------------------------------
-- The dashboard runs as `postgres`, which bypasses `protect_profile_columns`,
-- so these statements work before any admin exists:
--
--   -- 1. promote the first account
--   update public.profiles
--      set role = 'admin', status = 'approved',
--          approved_at = now(), verification_method = 'manual'
--    where username = 'REPLACE_WITH_YOUR_USERNAME';
--
--   -- 2. hand out the first invite codes
--   insert into public.invite_codes (code, label, max_uses)
--   values
--     ('OUST-FOUNDERS-2026', 'Founding cohort', 25),
--     ('OUST-CS-2026', 'Computer Science intake', 50)
--   on conflict (code) do nothing;
