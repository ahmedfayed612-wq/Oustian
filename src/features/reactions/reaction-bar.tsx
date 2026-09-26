"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  REACTIONS,
  applyReactionTap,
  reactionRequest,
  type Reaction,
  type ReactionTotals,
} from "./queries";
import { reactToCommentAction, reactToPostAction } from "./actions";
import { ReactionButton } from "./reaction-button";

export type ReactionTarget = "post" | "comment";

export type ReactionUsersModalState = {
  /** Which target the sheet is open for, or null when closed. */
  target: { type: ReactionTarget; id: string } | null;
  /** Which reaction tab the sheet opens on. */
  reaction: Reaction;
};

export type ReactionBarProps = {
  targetType: ReactionTarget;
  targetId: string;
  initial: ReactionTotals;
  /** Compact variant renders inside comment threads (same four reactions). */
  variant?: "post" | "comment";
  onOpenUsers: (target: { type: ReactionTarget; id: string }, reaction: Reaction) => void;
};

/**
 * Minimum time a press stays emphasised, so even an instant round trip reads
 * as a deliberate interaction instead of a flicker.
 */
const MIN_PRESS_MS = 300;

/**
 * The Oustians interaction language — the same four reactions on posts and
 * comments, sharing one component. Taps paint instantly (optimistic) and
 * reconcile with the server totals; failures revert and explain themselves.
 * Tapping the active reaction again clears it; picking another one moves it.
 * One in-flight mutation per bar: a second tap waits for the first round
 * trip, so rapid taps can never interleave states.
 */
export function ReactionBar({
  targetType,
  targetId,
  initial,
  variant = "post",
  onOpenUsers,
}: ReactionBarProps) {
  const t = useTranslations("Reactions");
  const tErrors = useTranslations("Reactions.errors");
  const [totals, setTotals] = useState<ReactionTotals>(initial);
  const [pending, setPending] = useState(false);
  const [justPressed, setJustPressed] = useState<Reaction | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleTap(reaction: Reaction) {
    if (pending) return;

    const previous = totals;
    const next = applyReactionTap(previous, reaction);

    setTotals(next);
    setFailed(false);
    setPending(true);
    setJustPressed(reaction);

    try {
      const action =
        targetType === "post" ? reactToPostAction : reactToCommentAction;
      const result = await action(targetId, reactionRequest(previous, reaction));

      if (result.status === "success") {
        setTotals(result.totals);
      } else {
        setTotals(previous);
        setFailed(true);
      }
    } catch {
      setTotals(previous);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  // The press animation keeps its full window even when the round trip is
  // instant: the timer, not the network, clears the emphasis.
  useEffect(() => {
    if (!justPressed) return;
    const id = setTimeout(() => setJustPressed(null), MIN_PRESS_MS);
    return () => clearTimeout(id);
  }, [justPressed]);

  const compact = variant === "comment";

  return (
    <div>
      <div
        role="group"
        aria-label={t("groupLabel")}
        className={
          compact
            ? "flex flex-wrap items-center gap-0.5"
            : "flex flex-wrap items-center gap-1"
        }
      >
        {REACTIONS.map((reaction) => (
          <ReactionButton
            key={reaction}
            reaction={reaction}
            count={totals[reaction]}
            active={totals.userReaction === reaction}
            pressed={justPressed === reaction}
            compact={compact}
            onTap={() => handleTap(reaction)}
            onOpenUsers={() => onOpenUsers({ type: targetType, id: targetId }, reaction)}
          />
        ))}
      </div>

      {failed ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {tErrors("failed")}
        </p>
      ) : null}
    </div>
  );
}

