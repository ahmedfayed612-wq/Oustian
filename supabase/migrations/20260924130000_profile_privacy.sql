-- ============================================================================
-- M2 — profile privacy
--
-- `is_private` is a product-level switch: private members still appear in
-- search and chat (approved members may identify each other), but their bio,
-- faculty, graduation year and join date are hidden from everyone except
-- themselves and admins. The RLS boundary stays "approved members only" —
-- nothing secret is stored here, so the gating happens where the profile is
-- rendered, not in policy.
-- ============================================================================

alter table public.profiles
  add column if not exists is_private boolean not null default false;

comment on column public.profiles.is_private is
  'When true, only the owner and admins see bio/faculty/year on profile screens.';
