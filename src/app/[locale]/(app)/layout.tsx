import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import type { ChromeMember } from "@/components/layout/member";
import { requireApprovedMember } from "@/features/auth/session";
import { facultyOptions } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";

/**
 * The signed-in app.
 *
 * `requireApprovedMember()` sends anonymous visitors to sign-in and unapproved
 * members to the holding screen, so every child can assume an approved profile
 * exists. The check is resolved once per request (React `cache` inside the
 * helper), and the avatar URL is signed here so client components never touch
 * Storage themselves.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedMember();
  const locale = await getLocale();
  const supabase = await createClient();
  const avatarUrl = await signedStorageUrl(supabase, profile.avatar_path);

  const faculty = facultyOptions.find(
    (option) => option.value === profile.faculty,
  );
  const headlineParts = [
    faculty ? (locale === "ar" ? faculty.nameAr : faculty.nameEn) : null,
    profile.graduation_year ? String(profile.graduation_year) : null,
  ].filter((part): part is string => Boolean(part));

  const member: ChromeMember = {
    fullName: profile.full_name,
    username: profile.username,
    headline: headlineParts.length > 0 ? headlineParts.join(" · ") : null,
    avatarUrl,
    isAdmin: profile.role === "admin",
  };

  return <AppShell member={member}>{children}</AppShell>;
}
