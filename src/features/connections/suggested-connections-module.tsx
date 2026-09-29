"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ConnectButton } from "@/features/connections/connect-button";
import type { SuggestedPerson } from "@/features/connections/suggestions";
import { Link } from "@/i18n/navigation";

/**
 * "People you may know", as a feed module.
 *
 * The desktop rail keeps the vertical list; on screens without a third column
 * these compact cards appear *inside* the feed instead (see
 * `buildFeedTimeline` for where, and how often). Horizontal scrolling on a
 * phone is the familiar pattern for this row — three cards, one thumb swipe —
 * and a module is only as tall as its cards, so it reads as part of the feed
 * rather than a banner.
 *
 * Dismissal is deliberately session-local: the product has no "hide this
 * person" table, and inventing one to power a single ✕ would be a second
 * recommendation system. The next render offers the row again — which is why
 * the button is a quiet affordance rather than a destructive action.
 */
export function SuggestedConnectionsModule({
  people,
}: {
  people: SuggestedPerson[];
}) {
  const t = useTranslations("Rail");
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  const visible = people.filter((person) => !dismissed.includes(person.id));

  // Everyone dismissed: the module removes itself rather than leaving an empty
  // frame where a card used to be.
  if (visible.length === 0) return null;

  return (
    <Card className="p-3">
      <h2 className="text-[0.9375rem] font-semibold text-text">
        {t("suggestionsTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("suggestionsBody")}</p>

      <ul className="-mx-1 mt-3 flex list-none snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {visible.map((person) => (
          <li key={person.id} className="w-40 shrink-0 snap-start">
            <div className="relative flex h-full flex-col items-center gap-2 rounded-control border border-border bg-surface-2/50 p-3 text-center">
              <button
                type="button"
                onClick={() =>
                  setDismissed((previous) => [...previous, person.id])
                }
                aria-label={t("dismissSuggestion", { name: person.fullName })}
                title={t("dismissSuggestion", { name: person.fullName })}
                className="absolute end-1 top-1 flex size-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X className="size-4" aria-hidden="true" />
              </button>

              <Link
                href={`/profile/${person.username}`}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-control"
              >
                <Avatar
                  size="md"
                  name={person.fullName}
                  src={person.avatarUrl}
                />
                <span className="line-clamp-2 text-sm leading-snug font-semibold text-text">
                  {person.fullName}
                </span>
                {person.headline ? (
                  <span className="line-clamp-1 text-xs text-muted">
                    {person.headline}
                  </span>
                ) : null}
              </Link>

              <ConnectButton
                otherId={person.id}
                initial="none"
                compact
                className="mt-auto items-center"
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
