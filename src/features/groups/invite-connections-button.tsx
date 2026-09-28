"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { listConnectedMembers, type MemberCard } from "@/features/connections/queries";
import { createClient } from "@/lib/supabase/client";
import { inviteGroupMemberAction } from "./actions";

/**
 * Owner-only "Invite" affordance. Opens the app's sheet idiom (backdrop +
 * Escape + locked body scroll) listing accepted connections who are not in
 * the group yet; each send goes through `invite_to_presentation_group`, which
 * re-checks connection status and the 10-member cap under a row lock.
 */
export function InviteConnectionsButton({
  groupId,
  spotsLeft,
  memberIds,
}: {
  groupId: string;
  spotsLeft: number;
  /** Current member user ids — already-in-group connections are filtered out. */
  memberIds: string[];
}) {
  const t = useTranslations("Groups");
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<MemberCard[] | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      const connections = await listConnectedMembers(supabase, userId, 50);
      if (cancelled) return;

      const inGroup = new Set(memberIds);
      setPeople(connections.filter((person) => !inGroup.has(person.id)));
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, memberIds]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function invite(personId: string) {
    setBusyId(personId);
    setError(null);

    const result = await inviteGroupMemberAction(groupId, personId);

    if (result.status === "error") {
      setError(result.error ?? null);
    } else {
      setInvited((current) => [...current, personId]);
    }

    setBusyId(null);
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        {t("invite")}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("inviteTitle")}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-card bg-surface p-4 sm:max-w-md sm:rounded-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-text">
                  {t("inviteTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {t("inviteHint", { spots: spotsLeft })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-2"
              >
                ✕
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}

            {people === null ? (
              <p className="mt-4 text-sm text-muted">…</p>
            ) : people.length === 0 ? (
              <p className="mt-4 rounded-control bg-surface-2 px-3 py-2 text-sm text-muted">
                {t("inviteEmpty")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-1">
                {people.map((person) => {
                  const alreadyInvited = invited.includes(person.id);
                  return (
                    <li
                      key={person.id}
                      className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-surface-2"
                    >
                      <Avatar size="sm" name={person.full_name} src={null} />
                      <span className="min-w-0 flex-1">
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
                      <Button
                        size="sm"
                        variant={alreadyInvited ? "ghost" : "primary"}
                        disabled={alreadyInvited}
                        isLoading={busyId === person.id}
                        onClick={() => invite(person.id)}
                      >
                        {alreadyInvited ? t("inviteSent") : t("invite")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
