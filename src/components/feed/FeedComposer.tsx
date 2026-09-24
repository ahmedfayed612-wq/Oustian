import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { requireApprovedMember } from "@/features/auth/session";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";

/**
 * The "what's on your mind?" bar that opens the feed. It opens the full
 * composer screen (`/create`) — photos, events and polls join that screen
 * when their milestones land, so no dead actions are shown today.
 */
export async function FeedComposer() {
  const t = await getTranslations("Composer");
  const viewer = await requireApprovedMember();

  const supabase = await createClient();
  const avatarUrl = await signedStorageUrl(supabase, viewer.avatar_path);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5">
        <Avatar size="md" name={viewer.full_name} src={avatarUrl} />
        <Link
          href="/create"
          className="flex min-h-11 flex-1 items-center rounded-pill bg-surface-2 px-4 text-sm text-muted transition-colors duration-200 ease-out-soft hover:bg-surface-2/70"
        >
          {t("placeholder")}
        </Link>
      </div>
    </Card>
  );
}
