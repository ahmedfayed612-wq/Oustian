"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { signedStorageUrls } from "@/lib/supabase/storage";
import { MessageButton } from "@/features/chat/message-button";
import type { MemberCard } from "./queries";

export type ConnectionsSheetProps = {
  /** Profile whose connections are listed. */
  profileId: string;
  /** Label shown in the sheet header (the connections-count text). */
  title: string;
  /** Called only by the open state holder — the sheet loads on mount. */
  onClose: () => void;
};

type SheetPerson = MemberCard & { avatarUrl: string | null };

/**
 * Connections sheet: every accepted connection of a profile, newest first.
 * Rows are approved members the viewer may already see (RLS), so nothing
 * private leaks. Escape and the backdrop close it; body scroll is locked.
 * Each row links to the profile and offers a Message shortcut straight into
 * the 1:1 chat thread.
 */
export function ConnectionsSheet({
  profileId,
  title,
  onClose,
}: ConnectionsSheetProps) {
  const t = useTranslations("Profile");
  const tConnect = useTranslations("Connect");
  const [people, setPeople] = useState<SheetPerson[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const { data: links } = await supabase
        .from("connections")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
        .order("responded_at", { ascending: false })
        .limit(50);

      if (cancelled) return;

      const otherIds = [
        ...new Set(
          (links ?? []).map((link) =>
            link.requester_id === profileId
              ? link.addressee_id
              : link.requester_id,
          ),
        ),
      ];

      if (otherIds.length === 0) {
        setPeople([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_path")
        .in("id", otherIds);

      const urls = await signedStorageUrls(
        supabase,
        (profiles ?? []).map((person) => person.avatar_path),
      );

      if (cancelled) return;

      const byId = new Map((profiles ?? []).map((person) => [person.id, person]));

      // Keep the newest-first order of the links query.
      setPeople(
        otherIds
          .map((id) => byId.get(id))
          .filter((person) => Boolean(person))
          .map((person) => ({
            id: person!.id,
            username: person!.username,
            full_name: person!.full_name,
            avatar_path: person!.avatar_path,
            avatarUrl: person!.avatar_path
              ? (urls[person!.avatar_path] ?? null)
              : null,
          })),
      );
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
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
          {people === null ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("connectionsLoading")}
            </p>
          ) : people.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("connectionsEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-2 rounded-control px-2 py-2 transition-colors hover:bg-surface-2"
                >
                  <Link
                    href={`/profile/${person.username}`}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <Avatar
                      size="sm"
                      name={person.full_name}
                      src={person.avatarUrl}
                    />
                    <span className="min-w-0 flex flex-col">
                      <span className="block truncate text-sm font-semibold text-text">
                        {person.full_name}
                      </span>
                      <span
                        className="block truncate text-xs text-muted"
                        dir="ltr"
                      >
                        @{person.username}
                      </span>
                    </span>
                  </Link>
                  <MessageButton
                    otherId={person.id}
                    compact
                    label={tConnect("message")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
