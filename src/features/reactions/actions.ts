"use server";

import { requireApprovedMember } from "@/features/auth/session";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  isReaction,
  parseReactionTotals,
  uuidPattern,
  type Reaction,
  type ReactionTotals,
} from "./queries";

export type ReactAction =
  | { status: "success"; totals: ReactionTotals }
  | {
      status: "error";
      /** Rendered from `Reactions.errors.<code>`. */
      code:
        | "not_authorised"
        | "invalid_target"
        | "invalid_reaction"
        | "too_many_attempts"
        | "failed";
    };

function mapRpcError(message: string | null | undefined): ReactAction {
  const text = (message ?? "").toLowerCase();

  if (text.includes("not_authorised")) {
    return { status: "error", code: "not_authorised" };
  }
  if (text.includes("invalid_target")) {
    return { status: "error", code: "invalid_target" };
  }
  if (text.includes("invalid_reaction")) {
    return { status: "error", code: "invalid_reaction" };
  }

  console.error("[reactions] rpc failed", message);
  return { status: "error", code: "failed" };
}

/**
 * Toggles or changes the caller's reaction on one post or comment. `reaction`
 * is the desired end state after the tap — the RPC maps "tap the active one
 * again" to a clear, so the client passes '' for that case and never needs to
 * know the previous row. The returned totals are painted directly, so the
 * client makes no follow-up request. No path revalidation: counts on other
 * screens refresh on their next visit; the acting screen is already correct.
 */
async function react(
  target: "post" | "comment",
  targetId: string,
  reaction: Reaction | "",
): Promise<ReactAction> {
  await requireApprovedMember();

  if (!uuidPattern.test(targetId)) {
    return { status: "error", code: "invalid_target" };
  }

  if (reaction !== "" && !isReaction(reaction)) {
    return { status: "error", code: "invalid_reaction" };
  }

  const supabase = await createClient();

  // The user id is derived inside Postgres from the session JWT — it is never
  // taken from the client, so a forged request can only ever act as the
  // caller themselves.
  const sessionUser = (await supabase.auth.getClaims()).data?.claims?.sub ?? "";

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.reaction,
    hashRateLimitKey(`user:${sessionUser}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const rpc =
    target === "post"
      ? supabase.rpc("react_to_post", {
          p_post: targetId,
          p_reaction: reaction,
        })
      : supabase.rpc("react_to_comment", {
          p_comment: targetId,
          p_reaction: reaction,
        });

  const { data, error } = await rpc;

  if (error || data === null) return mapRpcError(error?.message);

  return { status: "success", totals: parseReactionTotals(data) };
}

export async function reactToPostAction(
  postId: string,
  reaction: Reaction | "",
): Promise<ReactAction> {
  return react("post", postId, reaction);
}

export async function reactToCommentAction(
  commentId: string,
  reaction: Reaction | "",
): Promise<ReactAction> {
  return react("comment", commentId, reaction);
}

