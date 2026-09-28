"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { listStoryViewersAction } from "./actions";

type Viewer = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  viewedAt: string;
};

/**
 * Who watched one story — the author's own audience list.
 *
 * Same sheet idiom as the reaction-user list (backdrop + Escape close, body
 * scroll locked) so the app has one modal behaviour, not three. Rows come from
 * `listStoryViewersAction`, which Postgres caps to the story's author: for
 * anybody else the list is simply empty.
 */
export function StoryViewersSheet({
  storyId,
  title,
  onClose,
}: {
  storyId: string;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations("Stories");
  const format = useFormatter();
  const [viewers, setViewers] = useState<Viewer[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await listStoryViewersAction(storyId);
      if (cancelled) return;

      setViewers(result.status === "success" ? result.viewers : []);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [storyId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-card-lg border border-border bg-surface sm:rounded-card-lg"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-center text-[0.9375rem] font-semibold text-text">
            {title}
          </p>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-2">
          {viewers === null ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("audienceLoading")}
            </p>
          ) : viewers.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("audienceEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {viewers.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/profile/${person.username}`}
                    onClick={onClose}
                    className="flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-surface-2"
                  >
                    <Avatar
                      size="sm"
                      name={person.fullName}
                      src={person.avatarUrl}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">
                        {person.fullName}
                      </span>
                      <span
                        className="block truncate text-xs text-muted"
                        dir="ltr"
                      >
                        @{person.username}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {format.relativeTime(new Date(person.viewedAt))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
