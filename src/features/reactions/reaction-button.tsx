"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { Reaction } from "./queries";

export type ReactionMeta = {
  icon: string;
  /** Short visible label next to the icon (hidden on narrow screens). */
  labelKey: "fire" | "insight" | "same" | "talk";
  /** Screen-reader and tooltip phrasing: "React with Fire". */
  actionKey: "reactFire" | "reactInsight" | "reactSame" | "reactTalk";
  /** Animation hook, one per reaction (see globals.css `react-*` keyframes). */
  animClass: string;
};

export const REACTION_META: Record<Reaction, ReactionMeta> = {
  fire: {
    icon: "🔥",
    labelKey: "fire",
    actionKey: "reactFire",
    animClass: "animate-react-fire",
  },
  insight: {
    icon: "🧠",
    labelKey: "insight",
    actionKey: "reactInsight",
    animClass: "animate-react-insight",
  },
  same: {
    icon: "🤝",
    labelKey: "same",
    actionKey: "reactSame",
    animClass: "animate-react-same",
  },
  talk: {
    icon: "🗣️",
    labelKey: "talk",
    actionKey: "reactTalk",
    animClass: "animate-react-talk",
  },
};

export type ReactionButtonProps = {
  reaction: Reaction;
  count: number;
  active: boolean;
  /** True for ~300ms after a tap so the press animation always plays out. */
  pressed: boolean;
  compact: boolean;
  onTap: () => void;
  onOpenUsers: () => void;
};

/**
 * One reaction control: icon + label + count. A whole-button tap reacts
 * (optimistic, animated); the count is its own button that opens the
 * reaction-user sheet filtered to this reaction.
 */
export function ReactionButton({
  reaction,
  count,
  active,
  pressed,
  compact,
  onTap,
  onOpenUsers,
}: ReactionButtonProps) {
  const t = useTranslations("Reactions");

  const meta = REACTION_META[reaction];

  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-pill transition-colors",
        active ? "bg-brand-soft" : "hover:bg-surface-2",
      )}
    >
      <button
        type="button"
        onClick={onTap}
        aria-label={t(meta.actionKey)}
        aria-pressed={active}
        title={t(meta.actionKey)}
        className={cn(
          "flex min-h-9 items-center gap-1 rounded-s-pill font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand",
          compact ? "px-1.5 text-xs" : "px-2 text-sm",
          active ? "text-brand" : "text-muted hover:text-text",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block leading-none",
            compact ? "text-sm" : "text-base",
            pressed && meta.animClass,
          )}
        >
          {meta.icon}
        </span>
        <span className={cn(!compact && "hidden min-[26rem]:inline")}>
          {t(meta.labelKey)}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenUsers}
        aria-label={t("viewWhoReacted", { reaction: t(meta.labelKey) })}
        title={t("viewWhoReacted", { reaction: t(meta.labelKey) })}
        className={cn(
          "flex min-h-9 items-center rounded-e-pill font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-brand",
          compact ? "px-1 text-xs" : "px-1.5 text-sm",
          count > 0 ? "text-text hover:text-brand" : "text-muted",
        )}
      >
        {count}
      </button>
    </span>
  );
}
