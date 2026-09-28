"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { leaveOrRemoveGroupMemberAction } from "./actions";

/**
 * Leave (self) or remove (owner → another member) button. Confirmation is a
 * native `confirm` — the same pattern the feed uses for post deletion — and
 * success either navigates the member back to the list (leave) or drops the
 * row (remove, handled by the parent via `onRemoved`).
 */
export function GroupMemberActions({
  groupId,
  targetUserId,
  selfLeave = false,
  onRemoved,
}: {
  groupId: string;
  targetUserId?: string;
  /** Rendered as the standalone "Leave group" action when true. */
  selfLeave?: boolean;
  onRemoved?: (userId: string) => void;
}) {
  const t = useTranslations("Groups");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removingSelf = selfLeave || !targetUserId;
  const message = removingSelf ? t("leaveConfirm") : t("removeConfirm");

  async function handleAction() {
    if (busy || !window.confirm(message)) return;

    setBusy(true);
    setError(null);

    const result = await leaveOrRemoveGroupMemberAction(
      groupId,
      removingSelf ? undefined : targetUserId,
    );

    if (result.status === "error") {
      setError(result.error ?? null);
      setBusy(false);
      return;
    }

    if (removingSelf) {
      router.push("/groups");
      router.refresh();
      return;
    }

    if (targetUserId) onRemoved?.(targetUserId);
    // The roster is server-rendered: refresh so the removed row disappears.
    router.refresh();
    setBusy(false);
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={removingSelf ? "danger" : "ghost"}
        isLoading={busy}
        onClick={handleAction}
      >
        {!removingSelf && (
          <UserMinus className="size-3.5" aria-hidden="true" />
        )}
        {removingSelf ? t("leave") : t("remove")}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
