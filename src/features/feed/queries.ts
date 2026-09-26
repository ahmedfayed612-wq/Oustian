import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import {
  commentReactionTotals,
  EMPTY_REACTIONS,
  engagementScore,
  postReactionTotals,
  type ReactionTotals,
} from "@/features/reactions/queries";

/**
 * Feed reads. Batched on purpose (posts → authors → reactions → comment
 * counts) instead of joins the hand-written types can't express: predictable,
 * no N+1, and each result shape stays fully typed. Reactions arrive as
 * aggregates (four counts + the viewer's own), never as one row per reaction.
 */

export type FeedPost = {
  post: Tables<"posts">;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarPath: string | null;
  };
  reactions: ReactionTotals;
  commentCount: number;
  /** Ranking signal: reaction weights plus discussion weight. */
  score: number;
};

export type FeedComment = {
  comment: Tables<"post_comments">;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarPath: string | null;
  };
  reactions: ReactionTotals;
};

/**
 * Hydrates raw `posts` rows with author, like and comment counts in three
 * batched queries. Shared by the home feed (every post) and the profile
 * screens (one member's posts), so both render the exact same `FeedPost`
 * shape and `PostCard` props.
 */
async function hydrateFeedPosts(
  supabase: SupabaseClient<Database>,
  posts: Tables<"posts">[],
  viewerId: string,
): Promise<FeedPost[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => post.id);
  const authorIds = [...new Set(posts.map((post) => post.author_id))];

  const [authorsResult, reactions, commentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_path")
      .in("id", authorIds),
    postReactionTotals(supabase, postIds, viewerId),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
  ]);

  const authorsById = new Map(
    (authorsResult.data ?? []).map((author) => [
      author.id,
      {
        id: author.id,
        username: author.username,
        fullName: author.full_name,
        avatarPath: author.avatar_path,
      },
    ]),
  );

  const commentCounts = new Map<string, number>();

  for (const comment of commentsResult.data ?? []) {
    commentCounts.set(
      comment.post_id,
      (commentCounts.get(comment.post_id) ?? 0) + 1,
    );
  }

  return posts.map((post) => {
    const totals = reactions.get(post.id) ?? EMPTY_REACTIONS;
    const commentCount = commentCounts.get(post.id) ?? 0;

    return {
      post,
      // An author hidden by RLS (suspended mid-session) falls back to a stub so
      // the post still renders; search/profile reads would show the same truth.
      author: authorsById.get(post.author_id) ?? {
        id: post.author_id,
        username: "",
        fullName: "",
        avatarPath: null,
      },
      reactions: totals,
      commentCount,
      score: engagementScore(totals, commentCount),
    };
  });
}

/**
 * Feed ranking. Engagement (weighted reactions + comments) blended with
 * recency: a post's score halves every `HALF_LIFE_HOURS`, so the newest posts
 * lead as they always have, while something genuinely engaged climbs back
 * above older quiet posts instead of sinking with the clock. The weights
 * themselves live in `features/reactions/queries.ts` — retuning the ranking
 * never means touching the database.
 */
export function rankFeedPosts(posts: FeedPost[], now = Date.now()): FeedPost[] {
  const halfLifeMs = 18 * 60 * 60 * 1000;

  function rank(item: FeedPost) {
    const ageMs = Math.max(0, now - Date.parse(item.post.created_at));
    const recency = Math.pow(0.5, ageMs / halfLifeMs);

    // +1 so a brand-new post with no reactions still outranks an old one.
    return (item.score + 1) * recency;
  }

  return [...posts].sort((a, b) => rank(b) - rank(a));
}

export async function listFeedPosts(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  limit = 30,
): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[feed] posts read failed", error.message);
    return [];
  }

  return hydrateFeedPosts(supabase, posts ?? [], viewerId);
}

/**
 * One member's posts, newest first — the list both profile screens render
 * under their posts section. Backed by `posts_author_idx (author_id,
 * created_at DESC)`, so it stays an index scan as the table grows. RLS
 * already scopes visibility (`posts_select`), the author filter only narrows.
 */
export async function listAuthorPosts(
  supabase: SupabaseClient<Database>,
  authorId: string,
  viewerId: string,
  limit = 30,
): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[feed] author posts read failed", error.message);
    return [];
  }

  return hydrateFeedPosts(supabase, posts ?? [], viewerId);
}

/**
 * Comments for one post, oldest first, authors and reaction totals resolved in
 * two extra batched queries (never per comment). `viewerId` is what makes each
 * comment's `userReaction` correct for the person reading it.
 */
export async function listPostComments(
  supabase: SupabaseClient<Database>,
  postId: string,
  viewerId: string,
): Promise<FeedComment[]> {
  const { data: comments, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[feed] comments read failed", error.message);
    return [];
  }

  if (!comments || comments.length === 0) return [];

  const authorIds = [...new Set(comments.map((comment) => comment.author_id))];
  const commentIds = comments.map((comment) => comment.id);

  const [authorsResult, reactions] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_path")
      .in("id", authorIds),
    commentReactionTotals(supabase, commentIds, viewerId),
  ]);

  const authorsById = new Map(
    (authorsResult.data ?? []).map((author) => [
      author.id,
      {
        id: author.id,
        username: author.username,
        fullName: author.full_name,
        avatarPath: author.avatar_path,
      },
    ]),
  );

  return comments.map((comment) => ({
    comment,
    author: authorsById.get(comment.author_id) ?? {
      id: comment.author_id,
      username: "",
      fullName: "",
      avatarPath: null,
    },
    reactions: reactions.get(comment.id) ?? EMPTY_REACTIONS,
  }));
}
