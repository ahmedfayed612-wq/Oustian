import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The Oustians interaction language: fire (this is good), insight (I learned
 * something), same (I relate), talk (let's discuss). One active reaction per
 * member per target — toggling it off removes the row, picking another one
 * rewrites it. All writes go through the `react_to_post()` / `react_to_comment()`
 * RPCs; these queries only read the aggregated state the UI paints.
 */

export const REACTIONS = ["fire", "insight", "same", "talk"] as const;

export type Reaction = (typeof REACTIONS)[number];

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReactionTotals = {
  /** The viewer's own reaction, or null when they have none. */
  userReaction: Reaction | null;
  fire: number;
  insight: number;
  same: number;
  talk: number;
  total: number;
};

export const EMPTY_REACTIONS: ReactionTotals = {
  userReaction: null,
  fire: 0,
  insight: 0,
  same: 0,
  talk: 0,
  total: 0,
};

/**
 * Engagement score — the single number the feed ranking consumes. Insight and
 * talk carry the most weight (learning and conversation are the product's
 * purpose); fire and same score appreciation and relatability; every comment
 * and comment-count adds discussion weight. The weights live here in one
 * place so they can be retuned without touching the database or the feed.
 */
export const REACTION_WEIGHTS = {
  fire: 1.0,
  insight: 2.5,
  same: 1.5,
  talk: 3.0,
  comment: 2.0,
} as const;

export function isReaction(value: unknown): value is Reaction {
  return (
    typeof value === "string" && (REACTIONS as readonly string[]).includes(value)
  );
}

type RpcTotals = {
  user_reaction: string | null;
  fire: number | string;
  insight: number | string;
  same: number | string;
  talk: number | string;
  total: number | string;
};

/** Normalises the `react_to_*` JSON payload into typed UI state. */
export function parseReactionTotals(raw: unknown): ReactionTotals {
  if (typeof raw !== "object" || raw === null) return EMPTY_REACTIONS;

  const source = raw as Partial<Record<keyof RpcTotals, unknown>>;
  const number = (value: unknown) =>
    typeof value === "number" ? value : Number(value ?? 0) || 0;

  return {
    userReaction: isReaction(source.user_reaction)
      ? source.user_reaction
      : null,
    fire: number(source.fire),
    insight: number(source.insight),
    same: number(source.same),
    talk: number(source.talk),
    total: number(source.total),
  };
}

/**
 * Both tables share one shape, so the counting is one reducer. Two literal
 * queries per page of targets — the batch and the viewer's own rows — keep the
 * feed at two reads no matter how many reactions a post has.
 */
type ReactedRow = { reaction: string };

function reduceTotals(
  targetIds: string[],
  all: { id: string; rows: ReactedRow[] }[],
  mine: { id: string; rows: ReactedRow[] }[],
): Map<string, ReactionTotals> {
  const totals = new Map<string, ReactionTotals>(
    targetIds.map((id) => [id, { ...EMPTY_REACTIONS }]),
  );

  for (const group of all) {
    const entry = totals.get(group.id);
    if (!entry) continue;

    for (const row of group.rows) {
      if (!isReaction(row.reaction)) continue;
      entry[row.reaction] += 1;
      entry.total += 1;
    }
  }

  for (const group of mine) {
    const entry = totals.get(group.id);
    if (entry && isReaction(group.rows[0]?.reaction)) {
      entry.userReaction = group.rows[0].reaction;
    }
  }

  return totals;
}

function groupBy(
  rows: { target: string; reaction: string }[],
): { id: string; rows: ReactedRow[] }[] {
  const grouped = new Map<string, ReactedRow[]>();

  for (const row of rows) {
    const list = grouped.get(row.target) ?? [];
    list.push({ reaction: row.reaction });
    grouped.set(row.target, list);
  }

  return [...grouped].map(([id, list]) => ({ id, rows: list }));
}

/** Reaction totals for a page of posts, plus the viewer's own reaction. */
export async function postReactionTotals(
  supabase: SupabaseClient<Database>,
  postIds: string[],
  viewerId: string,
): Promise<Map<string, ReactionTotals>> {
  if (postIds.length === 0) return new Map();

  const [allResult, mineResult] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, reaction")
      .in("post_id", postIds),
    supabase
      .from("post_reactions")
      .select("post_id, reaction")
      .in("post_id", postIds)
      .eq("user_id", viewerId),
  ]);

  return reduceTotals(
    postIds,
    groupBy(
      (allResult.data ?? []).map((row) => ({
        target: row.post_id,
        reaction: row.reaction,
      })),
    ),
    groupBy(
      (mineResult.data ?? []).map((row) => ({
        target: row.post_id,
        reaction: row.reaction,
      })),
    ),
  );
}

/** Reaction totals for a page of comments, plus the viewer's own reaction. */
export async function commentReactionTotals(
  supabase: SupabaseClient<Database>,
  commentIds: string[],
  viewerId: string,
): Promise<Map<string, ReactionTotals>> {
  if (commentIds.length === 0) return new Map();

  const [allResult, mineResult] = await Promise.all([
    supabase
      .from("comment_reactions")
      .select("comment_id, reaction")
      .in("comment_id", commentIds),
    supabase
      .from("comment_reactions")
      .select("comment_id, reaction")
      .in("comment_id", commentIds)
      .eq("user_id", viewerId),
  ]);

  return reduceTotals(
    commentIds,
    groupBy(
      (allResult.data ?? []).map((row) => ({
        target: row.comment_id,
        reaction: row.reaction,
      })),
    ),
    groupBy(
      (mineResult.data ?? []).map((row) => ({
        target: row.comment_id,
        reaction: row.reaction,
      })),
    ),
  );
}

/**
 * Engagement score for one target: each reaction weight times its count, plus
 * the discussion weight for every comment. This single number is the feed's
 * ranking signal — see `rankFeedPosts()` in features/feed/queries.ts.
 */
export function engagementScore(
  totals: ReactionTotals,
  commentCount = 0,
): number {
  return (
    totals.fire * REACTION_WEIGHTS.fire +
    totals.insight * REACTION_WEIGHTS.insight +
    totals.same * REACTION_WEIGHTS.same +
    totals.talk * REACTION_WEIGHTS.talk +
    commentCount * REACTION_WEIGHTS.comment
  );
}

/**
 * The optimistic transition for one tap: tapping the active reaction clears it,
 * picking another moves it, picking a new one adds it — the same three states
 * the server enforces, defined once and shared with the unit tests.
 */
export function applyReactionTap(
  totals: ReactionTotals,
  reaction: Reaction,
): ReactionTotals {
  const next: ReactionTotals = { ...totals };
  const clearing = totals.userReaction === reaction;

  if (totals.userReaction) {
    next[totals.userReaction] = Math.max(0, next[totals.userReaction] - 1);
    next.total = Math.max(0, next.total - 1);
  }

  if (clearing) {
    next.userReaction = null;
  } else {
    next[reaction] += 1;
    next.total += 1;
    next.userReaction = reaction;
  }

  return next;
}

/**
 * What the tap means to the server: '' clears the caller's reaction, anything
 * else sets it (the RPC upserts, so changing is the same call as creating).
 */
export function reactionRequest(
  totals: ReactionTotals,
  reaction: Reaction,
): Reaction | "" {
  return totals.userReaction === reaction ? "" : reaction;
}
