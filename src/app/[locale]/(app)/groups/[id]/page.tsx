import { notFound } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { remainingSpots } from "@/features/groups/capacity";
import { getPresentationGroupDetail } from "@/features/groups/queries";
import { GroupMemberActions } from "@/features/groups/group-member-actions";
import { InviteConnectionsButton } from "@/features/groups/invite-connections-button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Groups");
  const supabase = await createClient();
  const group = await getPresentationGroupDetail(supabase, id);

  return group
    ? { title: group.name || group.subject?.name_en || t("title") }
    : {};
}

/**
 * One presentation group: subject context, the full roster with the
 * {count}/10 capacity chip, and owner-only invite / remove affordances.
 * The RPCs re-check capacity under a row lock, so a race simply surfaces
 * as an inline error here.
 */
export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Groups");

  const supabase = await createClient();
  const group = await getPresentationGroupDetail(supabase, id);

  if (!group || group.status !== "active") notFound();

  const memberCount = group.memberCount ?? group.members?.length ?? 0;
  const isOwner = group.members?.some(
    (member) => member.user_id === viewer.id && member.role === "owner",
  );
  const spotsLeft = remainingSpots(memberCount);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={
          group.name ||
          group.subject?.name_en ||
          t("subjectFallback")
        }
        description={
          group.subject
            ? `${group.subject.code} · ${group.subject.name_en}`
            : t("description")
        }
        action={
          <Link
            href="/groups"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("backToGroups")}
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="brand">{t("membersCount", { count: memberCount })}</Chip>
        {isOwner && spotsLeft > 0 ? (
          <InviteConnectionsButton
            groupId={group.id}
            spotsLeft={spotsLeft}
            memberIds={(group.members ?? []).map((m) => m.user_id)}
          />
        ) : null}
      </div>

      {group.description ? (
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-text" dir="auto">
            {group.description}
          </p>
        </Card>
      ) : null}

      {!group.members || group.members.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" aria-hidden="true" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul>
            {group.members.map((member) => {
              const profile = member.profile;
              const isSelf = member.user_id === viewer.id;

              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-text">
                        {profile?.full_name ?? "—"}
                      </span>
                      {member.role === "owner" ? (
                        <Chip tone="accent">{t("ownerChip")}</Chip>
                      ) : null}
                      {isSelf ? <Chip>{t("youChip")}</Chip> : null}
                    </span>
                    {profile ? (
                      <span
                        className="mt-0.5 block truncate text-xs text-muted"
                        dir="ltr"
                      >
                        @{profile.username}
                      </span>
                    ) : null}
                  </span>

                  {isOwner && !isSelf ? (
                    <GroupMemberActions
                      groupId={group.id}
                      targetUserId={member.user_id}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {!isOwner ? (
        <div className="flex justify-end">
          <GroupMemberActions groupId={group.id} selfLeave />
        </div>
      ) : null}
    </div>
  );
}
