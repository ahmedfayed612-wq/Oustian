import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils/cn";
import { Bell } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("Notifications");

  return { title: t("title") };
}

/**
 * The notification inbox: likes and comments on the member's posts. Opening
 * the screen advances the read cursor (own-row update, RLS-checked) *after*
 * the snapshot is taken, so unread rows still get their highlight this visit.
 */
export default async function NotificationsPage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Notifications");
  const format = await getFormatter();

  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notifications] read failed", error.message);
  }

  const notifications = rows ?? [];

  const unreadIds = notifications
    .filter((row) => !row.read_at)
    .map((row) => row.id);

  if (unreadIds.length > 0) {
    const { error: markError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", viewer.id)
      .in("id", unreadIds);

    if (markError) {
      console.error("[notifications] mark read failed", markError.message);
    }
  }

  const actorIds = [
    ...new Set(
      notifications
        .map((row) => row.actor_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const postIds = [
    ...new Set(
      notifications
        .map((row) => row.post_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [actorsResult, postsResult] = await Promise.all([
    actorIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_path")
          .in("id", actorIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase.from("posts").select("id, body").in("id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actorsById = new Map(
    (actorsResult.data ?? []).map((actor) => [actor.id, actor]),
  );
  const postsById = new Map(
    (postsResult.data ?? []).map((post) => [post.id, post]),
  );

  const avatarUrls = await signedStorageUrls(
    supabase,
    (actorsResult.data ?? []).map((actor) => actor.avatar_path),
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("title")} description={t("description")} />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul>
            {notifications.map((row) => {
              const actor = row.actor_id ? actorsById.get(row.actor_id) : null;
              const actorName =
                actor?.full_name ?? actor?.username ?? t("someone");
              const post = row.post_id ? postsById.get(row.post_id) : null;
              const snippet = post
                ? post.body.slice(0, 90) + (post.body.length > 90 ? "…" : "")
                : null;

              // One aggregated row per actor and kind (see the reaction
              // triggers): `reaction_count` says how many of the member''s
              // posts/comments they reacted to, so the inbox never spams.
              const extras = row.reaction_count > 1 ? row.reaction_count - 1 : 0;
              const message = (() => {
                switch (row.type) {
                  case "post_comment":
                    return t("commented", { name: actorName });
                  case "connection_request":
                    return t("connectRequest", { name: actorName });
                  case "post_reaction":
                    return extras > 0
                      ? t("reactedOnPosts", { name: actorName, count: extras })
                      : t("reactedToPost", { name: actorName });
                  case "post_talk":
                    return t("talkedAboutPost", { name: actorName });
                  case "comment_reaction":
                    return t("reactedToComment", { name: actorName });
                  case "comment_talk":
                    return t("talkedAboutComment", { name: actorName });
                  default:
                    return t("liked", { name: actorName });
                }
              })();

              // Connection requests land on the requester's profile;
              // everything else still leads back to the feed.
              const href =
                row.type === "connection_request" && actor?.username
                  ? `/profile/${actor.username}`
                  : "/";

              return (
                <li key={row.id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
                      !row.read_at && "bg-brand-soft/50",
                    )}
                  >
                    <Avatar
                      size="md"
                      name={actorName}
                      src={
                        actor?.avatar_path
                          ? (avatarUrls[actor.avatar_path] ?? null)
                          : null
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 text-sm text-text" dir="auto">
                          {message}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {format.relativeTime(new Date(row.created_at))}
                        </span>
                      </span>
                      {snippet ? (
                        <span
                          className="mt-0.5 block truncate text-xs text-muted"
                          dir="auto"
                        >
                          {t("onYourPost", { snippet })}
                        </span>
                      ) : null}
                    </span>
                    {!row.read_at ? (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-pill bg-brand"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
