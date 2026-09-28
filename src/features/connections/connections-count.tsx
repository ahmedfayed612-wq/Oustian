"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConnectionsSheet } from "@/features/connections/connections-sheet";

/**
 * Clickable connections-count chip: the server renders the count text, this
 * wrapper makes it a button that opens the connections sheet (same pattern
 * as the reaction-users sheet).
 */
export function ConnectionsCount({
  profileId,
  count,
}: {
  profileId: string;
  count: number;
}) {
  const t = useTranslations("Profile");
  const [open, setOpen] = useState(false);
  const label = t("connectionsCount", { count });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
      >
        {label}
      </button>
      {open ? (
        <ConnectionsSheet
          profileId={profileId}
          title={label}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
