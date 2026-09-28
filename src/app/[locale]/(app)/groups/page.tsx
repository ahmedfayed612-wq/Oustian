import { UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import {
  listMyPresentationGroups,
  listPendingGroupInvitations,
} from "@/features/groups/queries";
import { GroupInvitationList } from "@/features/groups/group-invitation-list";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

export async function generateMetadata() {
  const t = await getTranslations("Groups");

  return { title: t("title") };
}

/**
 * Presentation groups hub: incoming invitations (accept/decline) on top,
 * then every active group the member belongs to with its live member count.
 */
export default async function GroupsPage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Groups");

  const supabase = await createClient();
  const [groups, invitations] = await Promise.all([
    listMyPresentationGroups(supabase, viewer.id),
    listPendingGroupInvitations(supabase, viewer.id),
  ]);

  // One batched Storage call signs every inviter avatar in the list.
  const inviterAvatarUrls = await signedStorageUrls(
    supabase,
    invitations.map((invitation) => invitation.inviter?.avatar_path ?? null),
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href="/groups/create"
            className={buttonClasses({ size: "sm" })}
          >
            {t("newGroup")}
          </Link>
        }
      />

      <GroupInvitationList
        initialInvitations={invitations}
        avatarUrls={inviterAvatarUrls}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" aria-hidden="true" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="block rounded-card transition-colors focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Card className="p-4 transition-colors hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-semibold text-text">
                        {group.name || group.subject?.name_en || t("subjectFallback")}
                      </p>
                      {group.name && group.subject ? (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          <span dir="ltr">
                            {group.subject.code} · {group.subject.name_en}
                          </span>
                        </p>
                      ) : null}
                      {group.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted" dir="auto">
                          {group.description}
                        </p>
                      ) : null}
                    </div>
                    <Chip tone="brand" className="shrink-0">
                      {t("membersCount", { count: group.memberCount ?? 1 })}
                    </Chip>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
