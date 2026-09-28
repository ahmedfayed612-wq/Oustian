"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import { StoryViewersSheet } from "./story-viewers-sheet";
import { applyStoryView, neighbourStoryIndex } from "./queries";
import {
  deleteStoryAction,
  loadStoryRingAction,
  recordStoryViewAction,
  type StoryRingPayload,
} from "./actions";

type Status = "loading" | "ready" | "error";

/**
 * Full-screen story player.
 *
 * Deliberate product choices, all of them visible in the code:
 * - **No auto-advance timer.** The brief asks for navigation, not a slideshow;
 *   a tap-driven viewer respects reduced-motion preferences for free and never
 *   yanks a photo away mid-read. The segmented bar therefore reads as "where am
 *   I in this person's day", not as a countdown.
 * - **Playback starts at the first unwatched item**, so re-opening a ring with
 *   one new story does not replay the four you already saw.
 * - **Views are recorded from here, never from the tray** — rendering the rail
 *   must not count as a watch, and Postgres dedupes per (story, viewer).
 */
export function StoryViewer({
  authorIds,
  initialAuthorId,
  meId,
  onClose,
}: {
  /** Tray order, so "next" can cross into the following author's ring. */
  authorIds: string[];
  initialAuthorId: string;
  /** The signed-in member, used to show author-only controls (audience, delete). */
  meId: string;
  onClose: () => void;
}) {
  const t = useTranslations("Stories");
  const format = useFormatter();

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<Element | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [now] = useState(() => Date.now());
  const [authorId, setAuthorId] = useState(initialAuthorId);
  const [loadedAuthorId, setLoadedAuthorId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [ring, setRing] = useState<StoryRingPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCurrentRingLoading = authorId !== loadedAuthorId;
  const items = isCurrentRingLoading ? [] : ring?.items ?? [];
  const current = items[index] ?? null;

  // ---- load one ring ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await loadStoryRingAction(authorId);

      if (cancelled) return;

      if (result.status !== "success") {
        setRing(null);
        setLoadedAuthorId(authorId);
        setStatus("error");
        return;
      }

      // Resume at the first unwatched story, or start from the top.
      const firstUnseen = result.ring.items.findIndex((item) => !item.viewedByMe);

      setRing(result.ring);
      setLoadedAuthorId(authorId);
      setIndex(firstUnseen === -1 ? 0 : firstUnseen);
      setStatus("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  // ---- record the watch that is actually on screen ------------------------
  useEffect(() => {
    if (status !== "ready" || !current) return;

    const storyId = current.id;
    let cancelled = false;

    async function record() {
      const result = await recordStoryViewAction(storyId);
      if (cancelled || result.status !== "success") return;

      setRing((previous) =>
        previous
          ? {
              ...previous,
              items: applyStoryView(
                previous.items,
                storyId,
                result.viewerCount ?? 0,
              ),
            }
          : previous,
      );
    }

    void record();

    return () => {
      cancelled = true;
    };
  }, [status, current]);

  // ---- navigation ---------------------------------------------------------
  const goNext = useCallback(() => {
    const neighbour = neighbourStoryIndex(index, items.length, "next");
    if (neighbour !== null) {
      setIndex(neighbour);
      return;
    }

    const nextAuthor = authorIds[authorIds.indexOf(authorId) + 1];
    if (nextAuthor) {
      setAuthorId(nextAuthor);
      return;
    }

    onClose();
  }, [authorId, authorIds, index, items.length, onClose]);

  const goPrevious = useCallback(() => {
    const neighbour = neighbourStoryIndex(index, items.length, "previous");
    if (neighbour !== null) {
      setIndex(neighbour);
      return;
    }

    const previousAuthor = authorIds[authorIds.indexOf(authorId) - 1];
    if (previousAuthor) setAuthorId(previousAuthor);
  }, [authorId, authorIds, index, items.length]);

  // ---- keyboard, scroll lock and focus ------------------------------------
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrevious();
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;

      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, [goNext, goPrevious, onClose]);

  // ---- swipe --------------------------------------------------------------
  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // Horizontal intent only: a vertical drag is a scroll attempt, not a swipe.
    if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) goNext();
    else goPrevious();
  }

  async function handleDelete() {
    if (!current) return;

    // Deleting is the member's own content: one confirmation, then it is gone
    // for everyone (the same confirm pattern the connect button uses for
    // destructive actions).
    if (!window.confirm(t("deleteConfirm"))) return;

    const storyId = current.id;
    setDeleting(true);

    const result = await deleteStoryAction(storyId);

    setDeleting(false);

    if (result.status !== "success") return;

    const remaining = items.filter((item) => item.id !== storyId);

    if (remaining.length > 0) {
      setRing((previous) =>
        previous ? { ...previous, items: remaining } : previous,
      );
      setIndex(Math.min(index, remaining.length - 1));
      return;
    }

    // Nothing left in this ring: move on, or close if this was the last one.
    const nextAuthor = authorIds[authorIds.indexOf(authorId) + 1];
    if (nextAuthor) setAuthorId(nextAuthor);
    else onClose();
  }

  const authorName = ring?.author.fullName ?? "";
  const timeLabel = current ? format.relativeTime(new Date(current.createdAt)) : "";
  // Only the author sees the audience or the delete control — the same rule the
  // row policies enforce, mirrored in the UI so nothing is offered then refused.
  const isOwnRing = Boolean(meId) && ring?.author.id === meId;
  const isPending = isCurrentRingLoading || status === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("viewerLabel", { name: authorName || t("trayTitle") })}
        onClick={(event) => event.stopPropagation()}
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[92dvh] sm:rounded-card-lg sm:border sm:border-white/10"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Progress: where this story sits in the author's day. */}
        <div
          className="flex gap-1 px-3 pt-3"
          role="group"
          aria-label={t("progressLabel", {
            current: Math.min(index + 1, Math.max(items.length, 1)),
            total: Math.max(items.length, 1),
          })}
        >
          {items.map((item, position) => (
            <span
              key={item.id}
              aria-hidden="true"
              className={cn(
                "h-1 flex-1 rounded-pill",
                position === index
                  ? "bg-brand"
                  : position < index || item.viewedByMe
                    ? "bg-white/60"
                    : "bg-white/25",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar size="sm" name={authorName} src={ring?.author.avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {authorName}
            </span>
            <span className="block text-xs text-white/60">{timeLabel}</span>
          </span>

          {current && isOwnRing ? (
            <button
              type="button"
              onClick={() => setViewersOpen(true)}
              className="flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={t("viewAudience", { count: current.viewerCount })}
            >
              <Eye className="size-4" aria-hidden="true" />
              <span className="tabular-nums">{current.viewerCount}</span>
            </button>
          ) : null}

          {current && isOwnRing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex size-8 items-center justify-center rounded-pill text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
              aria-label={t("deleteStory")}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          ) : null}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-pill text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
            aria-label={t("closeViewer")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {isPending ? (
            <p className="flex items-center gap-2 py-16 text-sm text-white/70">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("loading")}
            </p>
          ) : !current ? (
            <p className="px-6 py-16 text-center text-sm text-white/70">
              {t("gone")}
            </p>
          ) : (
            <>
              <div
                className="relative flex w-full items-center justify-center"
                style={{
                  aspectRatio:
                    current.width && current.height
                      ? `${current.width} / ${current.height}`
                      : "3 / 4",
                  maxHeight: "100%",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt={current.caption ?? ""}
                  className="max-h-full max-w-full object-contain"
                />

                {/* Tap zones: the touch gestures, mirrored by the arrows below. */}
                <button
                  type="button"
                  onClick={goPrevious}
                  aria-label={t("previousStory")}
                  className="absolute inset-y-0 left-0 w-1/3 focus-visible:outline-2 focus-visible:outline-brand"
                />
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={t("nextStory")}
                  className="absolute inset-y-0 right-0 w-1/3 focus-visible:outline-2 focus-visible:outline-brand"
                />

                {current.caption ? (
                  <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-4 text-center text-sm leading-relaxed text-white">
                    {current.caption}
                  </p>
                ) : null}
              </div>

              {/* Desktop arrows — the tap zones stay for touch. */}
              <button
                type="button"
                onClick={goPrevious}
                aria-label={t("previousStory")}
                className="absolute left-2 hidden size-9 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand sm:flex"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label={t("nextStory")}
                className="absolute right-2 hidden size-9 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand sm:flex"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {current ? (
          <p className="px-3 pb-3 text-center text-[0.6875rem] text-white/50">
            {t("expiresIn", {
              hours: Math.max(
                1,
                Math.round(
                  (Date.parse(current.expiresAt) - now) / 3_600_000,
                ),
              ),
            })}
          </p>
        ) : null}
      </div>

      {viewersOpen && current ? (
        <StoryViewersSheet
          storyId={current.id}
          title={t("audienceTitle", { count: current.viewerCount })}
          onClose={() => setViewersOpen(false)}
        />
      ) : null}
    </div>
  );
}


