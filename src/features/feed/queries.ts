import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

/**
 * Feed reads. Four round trips on purpose (posts → authors → likes → comment
 * counts) instead of joins the hand-written types can't express: predictable,
 * batched, and each result shape stays fully typed.
 */

export type FeedPost = {
  post: Tables<"posts">;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarPath: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type FeedComment = {
  comment: Tables<"post_comments">;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarPath: string | null;
  };
};

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

  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((post) => post.id);
  const authorIds = [...new Set(posts.map((post) => post.author_id))];

  const [authorsResult, likesResult, commentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_path")
      .in("id", authorIds),
    supabase
      .from("post_likes")
      .select("post_id, user_id")
      .in("post_id", postIds),
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

  const likeCounts = new Map<string, number>();
  const likedPostIds = new Set<string>();

  for (const like of likesResult.data ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (like.user_id === viewerId) likedPostIds.add(like.post_id);
  }

  const commentCounts = new Map<string, number>();

  for (const comment of commentsResult.data ?? []) {
    commentCounts.set(
      comment.post_id,
      (commentCounts.get(comment.post_id) ?? 0) + 1,
    );
  }

  return posts.map((post) => ({
    post,
    // An author hidden by RLS (suspended mid-session) falls back to a stub so
    // the post still renders; search/profile reads would show the same truth.
    author: authorsById.get(post.author_id) ?? {
      id: post.author_id,
      username: "",
      fullName: "",
      avatarPath: null,
    },
    likeCount: likeCounts.get(post.id) ?? 0,
    likedByMe: likedPostIds.has(post.id),
    commentCount: commentCounts.get(post.id) ?? 0,
  }));
}

/** Comments for one post, oldest first, authors resolved in one extra query. */
export async function listPostComments(
  supabase: SupabaseClient<Database>,
  postId: string,
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

  const { data: authors } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path")
    .in("id", authorIds);

  const authorsById = new Map(
    (authors ?? []).map((author) => [
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
  }));
}
