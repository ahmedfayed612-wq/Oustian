"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { StoryViewer } from "./story-viewer";

/** One avatar in the rail — the data the server already signed for us. */
export type StoryTrayRing = {
  authorId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isSelf: boolean;
  unseenCount: number;
  itemCount: number;
};

/** "Sara Ahmed Ali" -> "Sara": the rail is narrow, full names truncate badly. */
function shortName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * The Stories rail at the top of the feed.
 *
 * Oustians-specific on purpose: rather than Instagram's gradient ring, unwatched
 * stories use the app's own brand ring plus a count badge (the same `Chip`
 * colour language as the rest of the product), watched rings go quiet, and the
 * member's own tile carries the add affordance. Nothing moves on its own — the
 * rail is a list of buttons, and every state is readable without animation.
 */
export function StoryTray({
  rings,
  meId,
  meFullName,
  meAvatarUrl,
}: {
  rings: StoryTrayRing[];
  meId: string;
  meFullName: string;
  meAvatarUrl: string | null;
}) {
  const t = useTranslations("Stories");
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null);

  const own = rings.find((ring) => ring.isSelf) ?? null;
  const others = rings.filter((ring) => !ring.isSelf);
  const ordered = [
    ...(own ? [own.authorId] : []),
    ...others.map((ring) => ring.authorId),
  ];

  function tileContent(ring: StoryTrayRing) {
    const label = ring.isSelf
      ? t("yourStory")
      : t("openStory", { name: shortName(ring.fullName) });
    const unseen = ring.unseenCount > 0;

    return (
      <>
        <span
          className={cn(
            "relative flex size-16 items-center justify-center rounded-pill p-[3px]",
            unseen
              ? "border-2 border-brand"
              : "border-2 border-border",
          )}
        >
          <Avatar size="lg" name={ring.fullName} src={ring.avatarUrl} />

          {unseen ? (
            <span
              className="absolute -end-0.5 -bottom-0.5 flex min-w-5 items-center justify-center rounded-pill border border-surface bg-brand px-1 text-[0.625rem] font-bold text-white tabular-nums"
              aria-hidden="true"
            >
              {ring.unseenCount}
            </span>
          ) : null}
        </span>

        <span className="w-full truncate text-center text-xs font-semibold text-text">
          {ring.isSelf ? t("yourStory") : shortName(ring.fullName)}
        </span>

        <span className="sr-only">{label}</span>
      </>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-text">{t("trayTitle")}</h2>
        <Link
          href="/create/story"
          className="rounded-pill px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
        >
          {t("add")}
        </Link>
      </div>

      <ul className="mt-3 flex list-none gap-3 overflow-x-auto pb-1">
        {/* The member's own tile: view when they have a story, add when not. */}
        <li className="shrink-0">
          {own ? (
            <button
              type="button"
              onClick={() => setViewingAuthorId(own.authorId)}
              className="flex w-20 flex-col items-center gap-1.5 rounded-control p-1 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              {tileContent(own)}
            </button>
          ) : (
            <Link
              href="/create/story"
              className="flex w-20 flex-col items-center gap-1.5 rounded-control p-1 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="relative flex size-16 items-center justify-center rounded-pill border-2 border-dashed border-border p-[3px]">
                <Avatar size="lg" name={meFullName} src={meAvatarUrl} />
                <span
                  className="absolute -end-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-pill border border-surface bg-brand text-white"
                  aria-hidden="true"
                >
                  <Plus className="size-3.5" />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-text">
                {t("yourStory")}
              </span>
              <span className="sr-only">{t("addStory")}</span>
            </Link>
          )}
        </li>

        {others.map((ring) => (
          <li key={ring.authorId} className="shrink-0">
            <button
              type="button"
              onClick={() => setViewingAuthorId(ring.authorId)}
              className="flex w-20 flex-col items-center gap-1.5 rounded-control p-1 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              {tileContent(ring)}
            </button>
          </li>
        ))}

        {others.length === 0 ? (
          <li className="flex min-h-16 items-center px-1 text-sm text-muted">
            {t("trayEmpty")}
          </li>
        ) : null}
      </ul>

      {viewingAuthorId ? (
        <StoryViewer
          authorIds={ordered}
          initialAuthorId={viewingAuthorId}
          meId={meId}
          onClose={() => setViewingAuthorId(null)}
        />
      ) : null}
    </Card>
  );
}
