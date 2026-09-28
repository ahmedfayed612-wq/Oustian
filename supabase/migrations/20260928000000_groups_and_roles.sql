-- ============================================================================
-- Presentation Groups & University Role Badges v1
--
-- Features B & C:
-- 1. Universities & Structured Subjects
-- 2. Presentation Groups (academic collaboration, max 10 members, connection-only invites,
--    atomic race-condition-free limit enforcement, ownership transfer)
-- 3. University Roles & Badges (institutional roles, admin verification, audit trail,
--    display separation from system permissions)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. UNIVERSITIES & STRUCTURED SUBJECTS
-- ---------------------------------------------------------------------------

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name_en text not null,
  name_ar text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.universities is
  'University organizations supported by Oustians.';

-- Seed default university (OUST)
insert into public.universities (id, slug, name_en, name_ar)
values (
  '00000000-0000-0000-0000-000000000001',
  'oust',
  'Obour University for Science and Technology',
  'جامعة العبور للعلوم والتكنولوجيا'
) on conflict (slug) do nothing;

create table if not exists public.university_subjects (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  code text not null,
  name_en text not null,
  name_ar text not null,
  faculty text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint university_subjects_code_uniq unique (university_id, code)
);

comment on table public.university_subjects is
  'Structured academic courses / subjects per university and faculty.';

create index if not exists university_subjects_active_idx
  on public.university_subjects (university_id, faculty, is_active);

-- Seed representative subjects for OUST
insert into public.university_subjects (university_id, code, name_en, name_ar, faculty)
values
  ('00000000-0000-0000-0000-000000000001', 'CS301', 'Database Systems', 'أنظمة قواعد البيانات', 'computer-science-ai'),
  ('00000000-0000-0000-0000-000000000001', 'CS302', 'Artificial Intelligence', 'الذكاء الاصطناعي', 'computer-science-ai'),
  ('00000000-0000-0000-0000-000000000001', 'CS204', 'Algorithms & Data Structures', 'الخوارزميات وهياكل البيانات', 'computer-science-ai'),
  ('00000000-0000-0000-0000-000000000001', 'CS405', 'Software Engineering', 'هندسة البرمجيات', 'computer-science-ai'),
  ('00000000-0000-0000-0000-000000000001', 'ENG101', 'Circuit Theory', 'نظريات الدوائر الكهربية', 'engineering'),
  ('00000000-0000-0000-0000-000000000001', 'ENG205', 'Control Systems', 'نظم التحكم', 'engineering'),
  ('00000000-0000-0000-0000-000000000001', 'ENG302', 'Digital Signal Processing', 'معالجة الإشارات الرقمية', 'engineering'),
  ('00000000-0000-0000-0000-000000000001', 'PHAR101', 'Pharmacology I', 'علم الأدوية 1', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000001', 'PHAR202', 'Clinical Pharmacy', 'الصيدلة الإكلينيكية', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000001', 'BUS101', 'Marketing Management', 'إدارة التسويق', 'business-entrepreneurship'),
  ('00000000-0000-0000-0000-000000000001', 'BUS204', 'Corporate Finance', 'التمويل المؤسسي', 'business-entrepreneurship')
on conflict (university_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- 2. PRESENTATION GROUPS (FEATURE B)
-- ---------------------------------------------------------------------------

create table if not exists public.presentation_groups (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  subject_id uuid not null references public.university_subjects (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(btrim(description)) <= 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.presentation_groups is
  'Temporary, subject-specific presentation groups (max 10 students).';

create index if not exists presentation_groups_subject_idx
  on public.presentation_groups (subject_id, status);
create index if not exists presentation_groups_creator_idx
  on public.presentation_groups (created_by, status);

create table if not exists public.presentation_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.presentation_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  constraint presentation_group_members_user_uniq unique (group_id, user_id)
);

comment on table public.presentation_group_members is
  'Members belonging to a presentation group. Up to 10 members allowed per group.';

create index if not exists presentation_group_members_user_idx
  on public.presentation_group_members (user_id, joined_at desc);

create table if not exists public.presentation_group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.presentation_groups (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint presentation_group_invitations_self check (inviter_id <> invitee_id)
);

comment on table public.presentation_group_invitations is
  'Connection-only invitations to join a presentation group.';

create unique index if not exists presentation_group_invitations_pending_uniq
  on public.presentation_group_invitations (group_id, invitee_id)
  where status = 'pending';

create index if not exists presentation_group_invitations_invitee_idx
  on public.presentation_group_invitations (invitee_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. NOTIFICATION TYPES EXTENSION
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'post_like', 'post_comment', 'connection_request',
    'post_reaction', 'post_talk',
    'comment_reaction', 'comment_talk',
    'story_new',
    'group_invite', 'group_invite_accepted', 'group_invite_declined',
    'group_member_removed', 'group_ownership_transferred'
  ));

alter table public.notifications
  add column if not exists group_id uuid references public.presentation_groups (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. PRESENTATION GROUPS BUSINESS LOGIC & RPCs
-- ---------------------------------------------------------------------------

-- Membership probe usable from within RLS policies: a security-definer
-- function breaks the same-table recursion Postgres would otherwise raise
-- when `presentation_group_members_select` queries its own relation.
create or replace function public.is_presentation_group_member(
  p_group uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.presentation_group_members
    where group_id = p_group
      and user_id = p_user
  );
$$;

create or replace function public.is_presentation_group_owner(
  p_group uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.presentation_group_members
    where group_id = p_group
      and user_id = p_user
      and role = 'owner'
  );
$$;

-- Atomic group creation: group + owner member created in one go.
create or replace function public.create_presentation_group(
  p_subject_id uuid,
  p_name text default null,
  p_description text default null,
  p_initial_invitees uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_univ_id uuid;
  v_group_id uuid;
  v_invitee uuid;
  v_trimmed_name text := nullif(btrim(p_name), '');
  v_trimmed_desc text := nullif(btrim(p_description), '');
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  select university_id into v_univ_id
  from public.university_subjects
  where id = p_subject_id and is_active = true;

  if v_univ_id is null then
    raise exception 'invalid_subject' using errcode = 'check_violation';
  end if;

  -- Create group
  insert into public.presentation_groups (university_id, subject_id, created_by, name, description)
  values (v_univ_id, p_subject_id, v_me, v_trimmed_name, v_trimmed_desc)
  returning id into v_group_id;

  -- Add owner as first member
  insert into public.presentation_group_members (group_id, user_id, role)
  values (v_group_id, v_me, 'owner');

  -- Process initial invitees if provided
  if array_length(p_initial_invitees, 1) > 0 then
    -- Cannot invite more than 9 initial invitees (owner is 1, max is 10)
    if array_length(p_initial_invitees, 1) > 9 then
      raise exception 'group_limit_exceeded' using errcode = 'check_violation';
    end if;

    foreach v_invitee in array p_initial_invitees loop
      if v_invitee is not null and v_invitee <> v_me then
        -- Must be an accepted connection
        if public.are_connected(v_me, v_invitee) then
          insert into public.presentation_group_invitations (group_id, inviter_id, invitee_id)
          values (v_group_id, v_me, v_invitee)
          on conflict do nothing;

          -- Notify invitee
          insert into public.notifications (recipient_id, actor_id, type, group_id)
          values (v_invitee, v_me, 'group_invite', v_group_id);
        end if;
      end if;
    end loop;
  end if;

  return v_group_id;
end;
$$;

-- Atomic member invite
create or replace function public.invite_to_presentation_group(
  p_group_id uuid,
  p_invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
  v_member_count int;
  v_invite_id uuid;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  -- Requester must be owner of the group (`is distinct from` also rejects
  -- callers with no membership row, where `<> 'owner'` would be NULL).
  select role into v_role
  from public.presentation_group_members
  where group_id = p_group_id and user_id = v_me;

  if v_role is distinct from 'owner' then
    raise exception 'not_group_owner' using errcode = '42501';
  end if;

  if p_invitee_id = v_me then
    raise exception 'cannot_invite_self' using errcode = 'check_violation';
  end if;

  -- Invitee must be an accepted connection of the requester
  if not public.are_connected(v_me, p_invitee_id) then
    raise exception 'must_be_connected' using errcode = '42501';
  end if;

  -- Lock group row to prevent race condition on member limit
  perform 1
  from public.presentation_groups
  where id = p_group_id
  for update;

  -- Check current member count
  select count(*) into v_member_count
  from public.presentation_group_members
  where group_id = p_group_id;

  if v_member_count >= 10 then
    raise exception 'group_limit_reached' using errcode = 'check_violation';
  end if;

  -- Check if invitee is already a member
  if exists (
    select 1
    from public.presentation_group_members
    where group_id = p_group_id and user_id = p_invitee_id
  ) then
    raise exception 'already_member' using errcode = 'check_violation';
  end if;

  -- Insert invitation
  insert into public.presentation_group_invitations (group_id, inviter_id, invitee_id)
  values (p_group_id, v_me, p_invitee_id)
  returning id into v_invite_id;

  -- Send notification
  insert into public.notifications (recipient_id, actor_id, type, group_id)
  values (p_invitee_id, v_me, 'group_invite', p_group_id);

  return v_invite_id;
end;
$$;

-- Atomic invitation response
create or replace function public.respond_presentation_group_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_invite public.presentation_group_invitations;
  v_member_count int;
  v_owner_id uuid;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  select * into v_invite
  from public.presentation_group_invitations
  where id = p_invitation_id and invitee_id = v_me and status = 'pending';

  if v_invite.id is null then
    raise exception 'invitation_not_found' using errcode = 'check_violation';
  end if;

  -- Lock group row for update to ensure race-free limit check
  perform 1
  from public.presentation_groups
  where id = v_invite.group_id
  for update;

  select user_id into v_owner_id
  from public.presentation_group_members
  where group_id = v_invite.group_id and role = 'owner'
  limit 1;

  if not p_accept then
    update public.presentation_group_invitations
    set status = 'declined', responded_at = now()
    where id = v_invite.id;

    if v_owner_id is not null and v_owner_id <> v_me then
      insert into public.notifications (recipient_id, actor_id, type, group_id)
      values (v_owner_id, v_me, 'group_invite_declined', v_invite.group_id);
    end if;

    return false;
  end if;

  -- Check capacity
  select count(*) into v_member_count
  from public.presentation_group_members
  where group_id = v_invite.group_id;

  if v_member_count >= 10 then
    raise exception 'group_limit_reached' using errcode = 'check_violation';
  end if;

  -- Accept invitation
  update public.presentation_group_invitations
  set status = 'accepted', responded_at = now()
  where id = v_invite.id;

  -- Add to group members
  insert into public.presentation_group_members (group_id, user_id, role)
  values (v_invite.group_id, v_me, 'member')
  on conflict (group_id, user_id) do nothing;

  -- Notify owner
  if v_owner_id is not null and v_owner_id <> v_me then
    insert into public.notifications (recipient_id, actor_id, type, group_id)
    values (v_owner_id, v_me, 'group_invite_accepted', v_invite.group_id);
  end if;

  return true;
end;
$$;

-- Atomic member removal / leave with ownership transfer
create or replace function public.leave_presentation_group(
  p_group_id uuid,
  p_target_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_target uuid := coalesce(p_target_user_id, v_me);
  v_is_self boolean := (v_target = v_me);
  v_caller_role text;
  v_target_role text;
  v_remaining_count int;
  v_new_owner_id uuid;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  -- Lock group
  perform 1
  from public.presentation_groups
  where id = p_group_id
  for update;

  select role into v_caller_role
  from public.presentation_group_members
  where group_id = p_group_id and user_id = v_me;

  select role into v_target_role
  from public.presentation_group_members
  where group_id = p_group_id and user_id = v_target;

  if v_target_role is null then
    raise exception 'not_a_member' using errcode = 'check_violation';
  end if;

  -- Permission: only owner can remove someone else; a member may remove
  -- themselves. `is distinct from` matters here: a caller with no membership
  -- row has NULL role, and `NULL <> 'owner'` would silently pass the check.
  if not v_is_self and v_caller_role is distinct from 'owner' then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  -- Remove target from group
  delete from public.presentation_group_members
  where group_id = p_group_id and user_id = v_target;

  -- If removing another member, notify them
  if not v_is_self then
    insert into public.notifications (recipient_id, actor_id, type, group_id)
    values (v_target, v_me, 'group_member_removed', p_group_id);
  end if;

  -- Count remaining members
  select count(*) into v_remaining_count
  from public.presentation_group_members
  where group_id = p_group_id;

  if v_remaining_count = 0 then
    -- Archive empty group
    update public.presentation_groups
    set status = 'archived', updated_at = now()
    where id = p_group_id;
    return 'group_archived';
  end if;

  -- If the departing member was the owner, transfer ownership
  if v_target_role = 'owner' then
    select user_id into v_new_owner_id
    from public.presentation_group_members
    where group_id = p_group_id
    order by joined_at asc
    limit 1;

    if v_new_owner_id is not null then
      update public.presentation_group_members
      set role = 'owner'
      where group_id = p_group_id and user_id = v_new_owner_id;

      update public.presentation_groups
      set created_by = v_new_owner_id, updated_at = now()
      where id = p_group_id;

      -- Notify the new owner
      insert into public.notifications (recipient_id, actor_id, type, group_id)
      values (v_new_owner_id, v_me, 'group_ownership_transferred', p_group_id);

      return 'ownership_transferred';
    end if;
  end if;

  return 'removed';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. UNIVERSITY ROLE BADGES (FEATURE C)
-- ---------------------------------------------------------------------------

create table if not exists public.university_roles (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  category text not null check (category in ('teaching', 'administrative', 'leadership', 'support', 'other')),
  description text,
  display_priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint university_roles_name_uniq unique (university_id, name_en)
);

comment on table public.university_roles is
  'Structured university roles & titles configured per university.';

create index if not exists university_roles_active_idx
  on public.university_roles (university_id, category, display_priority desc);

-- Seed standard roles for OUST
insert into public.university_roles (university_id, name_en, name_ar, category, display_priority)
values
  -- Leadership
  ('00000000-0000-0000-0000-000000000001', 'University President', 'رئيس الجامعة', 'leadership', 100),
  ('00000000-0000-0000-0000-000000000001', 'Dean', 'عميد الكلية', 'leadership', 90),
  ('00000000-0000-0000-0000-000000000001', 'Vice Dean', 'وكيل الكلية', 'leadership', 85),
  ('00000000-0000-0000-0000-000000000001', 'Department Head', 'رئيس القسم', 'leadership', 80),
  -- Teaching Staff
  ('00000000-0000-0000-0000-000000000001', 'Professor', 'أستاذ دكتور', 'teaching', 70),
  ('00000000-0000-0000-0000-000000000001', 'Assistant Professor', 'أستاذ مساعد', 'teaching', 65),
  ('00000000-0000-0000-0000-000000000001', 'Lecturer', 'مدرس دكتور', 'teaching', 60),
  ('00000000-0000-0000-0000-000000000001', 'Teaching Assistant', 'مدرس مساعد', 'teaching', 55),
  ('00000000-0000-0000-0000-000000000001', 'Demonstrator', 'معيد', 'teaching', 50),
  -- Administrative Staff
  ('00000000-0000-0000-0000-000000000001', 'Student Affairs', 'شؤون الطلاب', 'administrative', 40),
  ('00000000-0000-0000-0000-000000000001', 'Administrative Staff', 'موظف إداري', 'administrative', 35),
  ('00000000-0000-0000-0000-000000000001', 'IT Staff', 'فريق تكنولوجيا المعلومات', 'support', 30),
  ('00000000-0000-0000-0000-000000000001', 'Library Staff', 'إدارة المكتبة', 'support', 25)
on conflict (university_id, name_en) do nothing;

create table if not exists public.user_university_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_role_id uuid not null references public.university_roles (id) on delete cascade,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'revoked', 'expired')),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_university_roles_uniq unique (user_id, university_role_id)
);

comment on table public.user_university_roles is
  'User university roles with official verification status.';

create index if not exists user_university_roles_verified_idx
  on public.user_university_roles (user_id, verification_status);

create table if not exists public.user_role_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_role_id uuid not null references public.user_university_roles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason text check (char_length(btrim(reason)) <= 280),
  created_at timestamptz not null default now()
);

comment on table public.user_role_audit_logs is
  'Audit trail of all role verification and revocation events.';

create index if not exists user_role_audit_logs_user_idx
  on public.user_role_audit_logs (user_id, created_at desc);

-- Admin verification RPC with audit log
create or replace function public.set_user_role_verification(
  p_user_role_id uuid,
  p_new_status text,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_role_row public.user_university_roles;
begin
  if v_admin is null or not public.is_admin(v_admin) then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  select * into v_role_row
  from public.user_university_roles
  where id = p_user_role_id
  for update;

  if v_role_row.id is null then
    raise exception 'role_not_found' using errcode = 'check_violation';
  end if;

  if p_new_status not in ('verified', 'rejected', 'revoked', 'expired') then
    raise exception 'invalid_status' using errcode = 'check_violation';
  end if;

  update public.user_university_roles
  set verification_status = p_new_status,
      verified_by = v_admin,
      verified_at = case when p_new_status = 'verified' then now() else verified_at end,
      expires_at = p_expires_at,
      updated_at = now()
  where id = p_user_role_id;

  -- Audit trail
  insert into public.user_role_audit_logs
    (user_role_id, user_id, actor_id, previous_status, new_status, reason)
  values
    (p_user_role_id, v_role_row.user_id, v_admin, v_role_row.verification_status, p_new_status, nullif(btrim(p_reason), ''));

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------

alter table public.universities enable row level security;
alter table public.university_subjects enable row level security;
alter table public.presentation_groups enable row level security;
alter table public.presentation_group_members enable row level security;
alter table public.presentation_group_invitations enable row level security;
alter table public.university_roles enable row level security;
alter table public.user_university_roles enable row level security;
alter table public.user_role_audit_logs enable row level security;

-- Read rules for catalog tables (universities, subjects, role definitions)
create policy universities_select on public.universities
  for select to authenticated
  using (is_active = true or public.is_admin());

create policy university_subjects_select on public.university_subjects
  for select to authenticated
  using (is_active = true or public.is_admin());

create policy university_roles_select on public.university_roles
  for select to authenticated
  using (is_active = true or public.is_admin());

-- Presentation groups: visible to members of the group, or approved admins
-- Presentation groups: visible to members of the group, invitees with a
-- pending invitation, or approved admins. Membership checks go through the
-- security-definer helpers so policies never query a relation from inside
-- that relation's own policy (Postgres forbids the recursion).
create policy presentation_groups_select on public.presentation_groups
  for select to authenticated
  using (
    public.is_admin()
    or public.is_presentation_group_member(public.presentation_groups.id)
    or exists (
      select 1
      from public.presentation_group_invitations
      where group_id = public.presentation_groups.id
        and invitee_id = auth.uid()
        and status = 'pending'
    )
  );

create policy presentation_groups_update on public.presentation_groups
  for update to authenticated
  using (
    public.is_admin()
    or public.is_presentation_group_owner(public.presentation_groups.id)
  );

-- Presentation group members
create policy presentation_group_members_select on public.presentation_group_members
  for select to authenticated
  using (
    public.is_admin()
    or public.is_presentation_group_member(public.presentation_group_members.group_id)
    or exists (
      select 1
      from public.presentation_group_invitations i
      where i.group_id = public.presentation_group_members.group_id
        and i.invitee_id = auth.uid()
        and i.status = 'pending'
    )
  );

-- Presentation group invitations: visible to inviter and invitee
create policy presentation_group_invitations_select on public.presentation_group_invitations
  for select to authenticated
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
    or public.is_admin()
  );

-- User university roles: verified badges are public to all approved members.
create policy user_university_roles_select on public.user_university_roles
  for select to authenticated
  using (
    (verification_status = 'verified' and (expires_at is null or expires_at > now()))
    or user_id = auth.uid()
    or public.is_admin()
  );

-- Audit logs: visible to admins only
create policy user_role_audit_logs_select on public.user_role_audit_logs
  for select to authenticated
  using (public.is_admin());

-- Admin writes: the assignment insert + its audit row are the only direct
-- (non-definer) writes in the feature; `set_user_role_verification` runs as
-- security definer and bypasses RLS by design.
create policy user_university_roles_admin_insert on public.user_university_roles
  for insert to authenticated
  with check (public.is_admin());

create policy user_university_roles_admin_update on public.user_university_roles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy user_role_audit_logs_admin_insert on public.user_role_audit_logs
  for insert to authenticated
  with check (public.is_admin());

-- Grants: default Supabase privileges hand every table to anon+authenticated,
-- so revoke first and grant exactly what each surface needs.
revoke all on public.universities from anon, authenticated;
revoke all on public.university_subjects from anon, authenticated;
revoke all on public.presentation_groups from anon, authenticated;
revoke all on public.presentation_group_members from anon, authenticated;
revoke all on public.presentation_group_invitations from anon, authenticated;
revoke all on public.university_roles from anon, authenticated;
revoke all on public.user_university_roles from anon, authenticated;
revoke all on public.user_role_audit_logs from anon, authenticated;

grant select on public.universities to authenticated;
grant select on public.university_subjects to authenticated;
grant select on public.university_roles to authenticated;
grant select, update on public.presentation_groups to authenticated;
grant select on public.presentation_group_members to authenticated;
grant select on public.presentation_group_invitations to authenticated;
grant select, insert, update on public.user_university_roles to authenticated;
grant select, insert on public.user_role_audit_logs to authenticated;

revoke execute on function public.create_presentation_group(uuid, text, text, uuid[]) from public;
grant execute on function public.create_presentation_group(uuid, text, text, uuid[]) to authenticated;

revoke execute on function public.invite_to_presentation_group(uuid, uuid) from public;
grant execute on function public.invite_to_presentation_group(uuid, uuid) to authenticated;

revoke execute on function public.respond_presentation_group_invitation(uuid, boolean) from public;
grant execute on function public.respond_presentation_group_invitation(uuid, boolean) to authenticated;

revoke execute on function public.leave_presentation_group(uuid, uuid) from public;
grant execute on function public.leave_presentation_group(uuid, uuid) to authenticated;

revoke execute on function public.set_user_role_verification(uuid, text, text, timestamptz) from public;
grant execute on function public.set_user_role_verification(uuid, text, text, timestamptz) to authenticated;
