import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import type { ChromeMember } from "@/components/layout/member";
import { requireApprovedMember } from "@/features/auth/session";
import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { headlineForMember } from "@/lib/profile-options";
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
 *
 * The unread notification count is resolved here too: the bell lives in the
 * chrome, so it is part of the layout rather than something every page below
 * would have to remember to ask for.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedMember();
  const locale = await getLocale();
  const supabase = await createClient();

  const [avatarUrl, unreadNotifications] = await Promise.all([
    signedStorageUrl(supabase, profile.avatar_path),
    getUnreadNotificationCount(),
  ]);

  const member: ChromeMember = {
    fullName: profile.full_name,
    username: profile.username,
    headline: headlineForMember(
      profile.faculty,
      profile.graduation_year,
      locale,
    ),
    avatarUrl,
    isAdmin: profile.role === "admin",
  };

  return (
    <AppShell member={member} unreadNotifications={unreadNotifications}>
      {children}
    </AppShell>
  );
}
