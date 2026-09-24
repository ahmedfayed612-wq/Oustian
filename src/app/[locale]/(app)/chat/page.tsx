import { MessageCircle } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireApprovedMember } from "@/features/auth/session";
import { listChatPreviews } from "@/features/chat/queries";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

export async function generateMetadata() {
  const t = await getTranslations("Chat");

  return { title: t("metaTitle") };
}

/**
 * The inbox: server-rendered from one `list_conversation_previews()` RPC, with
 * avatars signed in a single batch. Unread counts refresh with the page —
 * a thread that is open updates itself live through Realtime instead.
 */
export default async function ChatPage() {
  const viewer = await requireApprovedMember();
  const supabase = await createClient();
  const t = await getTranslations("Chat");
  const format = await getFormatter();

  const previews = await listChatPreviews(supabase);
  const avatarUrls = await signedStorageUrls(
    supabase,
    previews.map((preview) => preview.peer?.avatarPath),
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("listTitle")} description={t("listDescription")} />

      {previews.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand">
            <MessageCircle className="size-7" aria-hidden="true" />
          </span>
          <p className="text-[0.9375rem] font-semibold text-text">
            {t("emptyTitle")}
          </p>
          <p className="max-w-sm text-sm text-muted">{t("emptyBody")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul>
            {previews.map((preview) => {
              const peer = preview.peer;
              const previewAvatar = peer
                ? (avatarUrls[peer.avatarPath ?? ""] ?? null)
                : null;
              const previewText = preview.lastMessageBody
                ? preview.lastMessageSenderId === viewer.id
                  ? `${t("fromYou")}${preview.lastMessageBody}`
                  : preview.lastMessageBody
                : t("noMessages");

              return (
                <li
                  key={preview.conversationId}
                  className="border-b border-border last:border-b-0"
                >
                  <Link
                    href={`/chat/${preview.conversationId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <Avatar
                      size="md"
                      name={peer?.fullName || undefined}
                      src={previewAvatar}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[0.9375rem] font-semibold text-text">
                          {peer?.fullName || t("unknownPeer")}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {format.relativeTime(new Date(preview.lastMessageAt))}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={
                            preview.unreadCount > 0
                              ? "min-w-0 truncate text-sm font-semibold text-text"
                              : "min-w-0 truncate text-sm text-muted"
                          }
                          dir="auto"
                        >
                          {previewText}
                        </span>
                        {preview.unreadCount > 0 ? (
                          <Chip tone="brand" className="ms-auto shrink-0">
                            <span aria-hidden="true">
                              {preview.unreadCount}
                            </span>
                            <span className="sr-only">
                              {t("unread", { count: preview.unreadCount })}
                            </span>
                          </Chip>
                        ) : null}
                      </span>
                    </span>
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
