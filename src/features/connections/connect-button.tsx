"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { connectionAction, type ConnectionAction } from "./actions";
import type { ConnectionState } from "./queries";

export type ConnectButtonProps = {
  otherId: string;
  /** State the server rendered — the button paints from it, then optimistically. */
  initial: ConnectionState;
  /**
   * Rail/list variant: one short button per state instead of the paired
   * Accept/Decline controls, so dense rows keep room for the member's name.
   */
  compact?: boolean;
  className?: string;
};

/**
 * The connection control, LinkedIn-style: Connect → Pending (tap to cancel),
 * Accept/Decline when they asked first, Connected (tap to remove). One server
 * action per tap (`set_connection()` is idempotent), state updates
 * optimistically and reverts when the action reports an error.
 */
export function ConnectButton({
  otherId,
  initial,
  compact = false,
  className,
}: ConnectButtonProps) {
  const t = useTranslations("Connect");
  const [state, setState] = useState<ConnectionState>(initial);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(action: ConnectionAction) {
    setPending(true);
    setFailed(false);

    try {
      const result = await connectionAction(otherId, action);

      if (result.status === "success") {
        setState(result.state);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function confirmed(messageKey: "cancelConfirm" | "disconnectConfirm") {
    return window.confirm(t(messageKey));
  }

  const size = compact ? "sm" : "md";
  const loadingLabel = t("working");

  let control: React.ReactNode;

  if (state === "none") {
    control = (
      <Button
        variant="primary"
        size={size}
        onClick={() => run("request")}
        isLoading={pending}
        loadingLabel={loadingLabel}
      >
        <UserPlus className="size-4" aria-hidden="true" />
        {t("connect")}
      </Button>
    );
  } else if (state === "outgoing") {
    control = (
      <Button
        variant="secondary"
        size={size}
        onClick={() => {
          if (confirmed("cancelConfirm")) void run("cancel");
        }}
        isLoading={pending}
        loadingLabel={loadingLabel}
      >
        {t("pending")}
      </Button>
    );
  } else if (state === "incoming") {
    control = compact ? (
      // One tap accepts: set_connection() resolves a reversed request to
      // "connected" exactly like an explicit accept would.
      <Button
        variant="primary"
        size="sm"
        onClick={() => run("request")}
        isLoading={pending}
        loadingLabel={loadingLabel}
      >
        {t("accept")}
      </Button>
    ) : (
      <span className="inline-flex items-center gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => run("accept")}
          isLoading={pending}
          loadingLabel={loadingLabel}
        >
          {t("accept")}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => run("decline")}
          disabled={pending}
        >
          {t("decline")}
        </Button>
      </span>
    );
  } else {
    control = (
      <Button
        variant="secondary"
        size={size}
        onClick={() => {
          if (confirmed("disconnectConfirm")) void run("disconnect");
        }}
        isLoading={pending}
        loadingLabel={loadingLabel}
      >
        {t("connected")}
      </Button>
    );
  }

  return (
    <span
      className={cn("inline-flex flex-col items-end gap-1", className)}
      aria-busy={pending || undefined}
    >
      {control}

      {failed ? (
        <span role="alert" className="text-xs text-danger">
          {t("errors.failed")}
        </span>
      ) : null}
    </span>
  );
}
