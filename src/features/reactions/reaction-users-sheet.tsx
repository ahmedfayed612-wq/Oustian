"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { signedStorageUrls } from "@/lib/supabase/storage";
import type { ReactionTarget } from "./reaction-bar";
import { REACTION_META } from "./reaction-button";
import type { Reaction } from "./queries";

export type ReactionUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
};

export type ReactionUsersSheetProps = {
  target: { type: ReactionTarget; id: string } | null;
  initialReaction: Reaction;
  onClose: () => void;
};

/**
 * Reaction-user sheet: who reacted, newest first, filtered by reaction tabs.
 * Rows are approved members the viewer may already see (RLS), so nothing
 * private leaks. Escape and the backdrop close it; body scroll is locked.
 */
export function ReactionUsersSheet({
  target,
  initialReaction,
  onClose,
}: ReactionUsersSheetProps) {
  const t = useTranslations("Reactions");
  // The parent keys this sheet per target, so `tab` starts fresh each time it
  // opens and the load effect below never needs to reset state synchronously.
  const [tab, setTab] = useState<Reaction>(initialReaction);
  const [loaded, setLoaded] = useState<{
    key: string;
    list: ReactionUser[] | null;
  }>({ key: "", list: null });

  // Data from a previous tab/target is never shown: while the key mismatches
  // we render the loading state, then swap in the fresh list.
  const requestKey = target ? `${target.type}:${target.id}:${tab}` : "";
  const users = loaded.key === requestKey ? loaded.list : null;

  useEffect(() => {
    const current = target;
    if (!current) return;

    // Primitive copies keep the narrowing inside the async closure below.
    const targetId = current.id;
    const isPost = current.type === "post";
    const requestKey = `${current.type}:${current.id}:${tab}`;

    let cancelled = false;

    async function load() {
      const supabase = createClient();

      // Two explicit queries per target type: Supabase infers column types
      // from literal table names, so the post and comment paths stay typed.
      const rows =
        isPost
          ? (
              await supabase
                .from("post_reactions")
                .select("user_id")
                .eq("post_id", targetId)
                .eq("reaction", tab)
                .limit(50)
            ).data
          : (
              await supabase
                .from("comment_reactions")
                .select("user_id")
                .eq("comment_id", targetId)
                .eq("reaction", tab)
                .limit(50)
            ).data;

      if (cancelled) return;

      const ids = [...new Set((rows ?? []).map((row) => row.user_id))];

      if (ids.length === 0) {
        setLoaded({ key: requestKey, list: [] });
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_path")
        .in("id", ids);

      const urls = await signedStorageUrls(
        supabase,
        (profiles ?? []).map((person) => person.avatar_path),
      );

      if (cancelled) return;

      setLoaded({
        key: requestKey,
        list: (profiles ?? []).map((person) => ({
          id: person.id,
          username: person.username,
          fullName: person.full_name,
          avatarUrl: person.avatar_path
            ? (urls[person.avatar_path] ?? null)
            : null,
        })),
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [target, tab]);

  useEffect(() => {
    if (!target) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("usersTitle")}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-card-lg border border-border bg-surface sm:rounded-card-lg"
      >
        <div className="border-b border-border px-4 pt-3">
          <p className="text-center text-[0.9375rem] font-semibold text-text">
            {t("usersTitle")}
          </p>

          <div role="tablist" aria-label={t("usersTitle")} className="mt-2 flex gap-1 overflow-x-auto pb-2">
            {(Object.keys(REACTION_META) as Reaction[]).map((reaction) => (
              <button
                key={reaction}
                type="button"
                role="tab"
                aria-selected={tab === reaction}
                onClick={() => setTab(reaction)}
                className={
                  tab === reaction
                    ? "flex min-h-9 shrink-0 items-center gap-1 rounded-control bg-brand-soft px-2.5 text-sm font-semibold text-brand"
                    : "flex min-h-9 shrink-0 items-center gap-1 rounded-control px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
                }
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  {REACTION_META[reaction].icon}
                </span>
                {t(REACTION_META[reaction].labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-2" role="tabpanel">
          {users === null ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("usersLoading")}
            </p>
          ) : users.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("usersEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {users.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/profile/${person.username}`}
                    onClick={onClose}
                    className="flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-surface-2"
                  >
                    <Avatar size="sm" name={person.fullName} src={person.avatarUrl} />
                    <span className="min-w-0 flex flex-col">
                      <span className="block truncate text-sm font-semibold text-text">
                        {person.fullName}
                      </span>
                      <span className="block truncate text-xs text-muted" dir="ltr">
                        @{person.username}
                      </span>
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
