"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Heart, MessageCircle, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import type { FeedComment } from "@/features/feed/queries";
import { listPostComments } from "@/features/feed/queries";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { signedStorageUrls } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils/cn";

export type PostCardProps = {
  post: { id: string; body: string; created_at: string; author_id: string };
  author: { username: string; fullName: string; avatarUrl: string | null };
  me: { id: string; username: string; fullName: string; avatarUrl: string | null };
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  canDelete: boolean;
};

type LoadedComment = FeedComment & {
  author: FeedComment["author"] & { avatarUrl: string | null };
};

/**
 * Comment identity: avatar and name both deep-link to the member's profile.
 * An author hidden by RLS renders as a plain stub (no username to link to).
 */
function CommentAvatar({ author }: { author: LoadedComment["author"] }) {
  const avatar = (
    <Avatar
      size="xs"
      name={author.fullName || undefined}
      src={author.avatarUrl}
    />
  );

  if (!author.username) return avatar;

  return (
    <Link
      href={`/profile/${author.username}`}
      className="mt-0.5 shrink-0 rounded-pill focus-visible:outline-2 focus-visible:outline-brand"
    >
      {avatar}
    </Link>
  );
}

function CommentAuthorName({ author }: { author: LoadedComment["author"] }) {
  if (!author.username) {
    return <span className="text-xs font-semibold text-text">{author.fullName}</span>;
  }

  return (
    <Link
      href={`/profile/${author.username}`}
      className="text-xs font-semibold text-text transition-colors hover:text-brand"
    >
      {author.fullName}
    </Link>
  );
}

/**
 * One feed post. Likes, comments and deletion are all RLS-checked browser
 * writes (the chat pattern) — the server rendered the initial counts and the
 * card keeps them honest optimistically, reverting when a write fails.
 */
export function PostCard({
  post,
  author,
  me,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  canDelete,
}: PostCardProps) {
  const t = useTranslations("Post");
  const tAuth = useTranslations("Auth.errors");
  const format = useFormatter();

  const [hidden, setHidden] = useState(false);
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<LoadedComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<{ rootId: string; name: string } | null>(
    null,
  );
  const [replyBody, setReplyBody] = useState("");

  async function toggleLike() {
    const supabase = createClient();
    const wasLiked = liked;

    setLiked(!wasLiked);
    setLikeCount((count) => Math.max(0, count + (wasLiked ? -1 : 1)));

    const { error } = wasLiked
      ? await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", me.id)
      : await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: me.id });

    if (error) {
      setLiked(wasLiked);
      setLikeCount((count) => count + (wasLiked ? 1 : -1));
    }
  }

  async function toggleComments() {
    const opening = !showComments;

    setShowComments(opening);

    if (!opening || commentsLoaded) return;

    setCommentsLoaded(true);

    const supabase = createClient();
    const rows = await listPostComments(supabase, post.id);
    const urls = await signedStorageUrls(
      supabase,
      rows.map((row) => row.author.avatarPath),
    );

    setComments(
      rows.map((row) => ({
        ...row,
        author: {
          ...row.author,
          avatarUrl: row.author.avatarPath
            ? (urls[row.author.avatarPath] ?? null)
            : null,
        },
      })),
    );
  }

  /**
   * Writes one comment — top-level (`parentId` null) or a reply attached to
   * the thread root — and appends it to the loaded list optimistically. The
   * server normalises replies-to-replies onto the root, so we render exactly
   * what Postgres stored.
   */
  async function saveComment(body: string, parentId: string | null) {
    setPostingComment(true);
    setCommentError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("post_comments")
        .insert({ post_id: post.id, author_id: me.id, body, parent_id: parentId })
        .select()
        .single();

      if (error) {
        const text = error.message.toLowerCase();

        if (text.includes("too_many_attempts")) {
          setCommentError("too_many_attempts");
        } else if (text.includes("not_authorised")) {
          setCommentError("not_authorised");
        } else if (
          text.includes("post_comments_body_check") ||
          text.includes("23514")
        ) {
          setCommentError("too_long");
        } else {
          setCommentError("failed");
        }

        return false;
      }

      if (data) {
        setComments((prev) => [
          ...prev,
          {
            comment: data,
            author: {
              id: me.id,
              username: me.username,
              fullName: me.fullName,
              avatarPath: null,
              avatarUrl: me.avatarUrl,
            },
          },
        ]);
        setCommentCount((count) => count + 1);
      }

      return true;
    } catch {
      setCommentError("failed");
      return false;
    } finally {
      setPostingComment(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = commentBody.trim();

    if (!trimmed || postingComment) return;

    if (trimmed.length > 1000) {
      setCommentError("too_long");
      return;
    }

    if (await saveComment(trimmed, null)) setCommentBody("");
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = replyBody.trim();

    if (!trimmed || !replyTo || postingComment) return;

    if (trimmed.length > 1000) {
      setCommentError("too_long");
      return;
    }

    if (await saveComment(trimmed, replyTo.rootId)) {
      setReplyBody("");
      setReplyTo(null);
    }
  }

  /** Opens the inline reply box under a thread (tap again to dismiss it). */
  function toggleReply(rootId: string, name: string) {
    setReplyTo((current) =>
      current && current.rootId === rootId && current.name === name
        ? null
        : { rootId, name },
    );
    setReplyBody("");
  }

  // Threads are one level deep (the insert trigger flattens anything deeper),
  // so grouping is a single partition of the loaded rows.
  const rootComments = comments.filter((entry) => !entry.comment.parent_id);
  const repliesOf = (rootId: string) =>
    comments.filter((entry) => entry.comment.parent_id === rootId);

  async function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;

    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", post.id);

    if (!error) setHidden(true);
  }

  function commentErrorText(key: string): string {
    switch (key) {
      case "too_many_attempts":
        return tAuth("too_many_attempts");
      case "not_authorised":
        return tAuth("not_authorised");
      case "too_long":
        return t("commentTooLong");
      default:
        return t("commentFailed");
    }
  }

  if (hidden) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2.5 p-3.5">
        <Avatar
          size="md"
          name={author.fullName || undefined}
          src={author.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/profile/${author.username}`}
                className="block truncate text-[0.9375rem] font-semibold text-text hover:underline"
              >
                {author.fullName}
              </Link>
              <p className="mt-0.5 truncate text-xs text-muted">
                <span dir="ltr">@{author.username}</span>
                {" · "}
                {format.relativeTime(new Date(post.created_at))}
              </p>
            </div>

            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="-mt-1 flex size-9 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p
        className="px-3.5 pb-3 text-[0.9375rem] leading-relaxed text-text"
        dir="auto"
      >
        {post.body}
      </p>

      {likeCount > 0 || commentCount > 0 ? (
        <div className="flex items-center gap-3 px-3.5 pb-2 text-xs text-muted">
          {likeCount > 0 ? (
            <span>{t("likesSummary", { count: likeCount })}</span>
          ) : null}
          {commentCount > 0 ? (
            <span className="ms-auto">
              {t("commentsSummary", { count: commentCount })}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-around gap-1 border-t border-border p-1.5">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={cn(
            "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-sm font-semibold transition-colors",
            liked
              ? "text-brand"
              : "text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          <Heart
            className={cn("size-4", liked && "fill-current")}
            aria-hidden="true"
          />
          {liked ? t("liked") : t("like")}
        </button>

        <button
          type="button"
          onClick={toggleComments}
          aria-expanded={showComments}
          className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {showComments ? t("hideComments") : t("comment")}
        </button>
      </div>

      {showComments ? (
        <div className="border-t border-border px-3.5 py-3">
          {comments.length === 0 ? (
            <p className="pb-2 text-sm text-muted">{t("noComments")}</p>
          ) : (
            <ul className="flex flex-col gap-3 pb-2">
              {rootComments.map((entry) => (
                <li key={entry.comment.id} className="flex items-start gap-2">
                  <CommentAvatar author={entry.author} />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-card bg-surface-2 px-3 py-1.5">
                      <CommentAuthorName author={entry.author} />
                      <p
                        className="text-sm leading-relaxed text-text"
                        dir="auto"
                      >
                        {entry.comment.body}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3">
                        <time
                          dateTime={entry.comment.created_at}
                          className="text-[0.625rem] text-muted"
                        >
                          {format.relativeTime(
                            new Date(entry.comment.created_at),
                          )}
                        </time>
                        <button
                          type="button"
                          onClick={() =>
                            toggleReply(entry.comment.id, entry.author.fullName)
                          }
                          className="text-[0.625rem] font-semibold text-muted transition-colors hover:text-brand"
                        >
                          {t("reply")}
                        </button>
                      </div>
                    </div>

                    {repliesOf(entry.comment.id).length > 0 ? (
                      <ul className="mt-2 ms-4 flex flex-col gap-2">
                        {repliesOf(entry.comment.id).map((reply) => (
                          <li
                            key={reply.comment.id}
                            className="flex items-start gap-2"
                          >
                            <CommentAvatar author={reply.author} />
                            <div className="min-w-0 rounded-card bg-surface px-3 py-1.5">
                              <CommentAuthorName author={reply.author} />
                              <p
                                className="text-sm leading-relaxed text-text"
                                dir="auto"
                              >
                                {reply.comment.body}
                              </p>
                              <div className="mt-0.5 flex items-center gap-3">
                                <time
                                  dateTime={reply.comment.created_at}
                                  className="text-[0.625rem] text-muted"
                                >
                                  {format.relativeTime(
                                    new Date(reply.comment.created_at),
                                  )}
                                </time>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleReply(
                                      entry.comment.id,
                                      reply.author.fullName,
                                    )
                                  }
                                  className="text-[0.625rem] font-semibold text-muted transition-colors hover:text-brand"
                                >
                                  {t("reply")}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {replyTo?.rootId === entry.comment.id ? (
                      <form
                        onSubmit={submitReply}
                        className="mt-2 flex items-center gap-2"
                      >
                        <label htmlFor={`reply-${post.id}`} className="sr-only">
                          {t("replyTo", { name: replyTo.name })}
                        </label>
                        <input
                          id={`reply-${post.id}`}
                          value={replyBody}
                          onChange={(event) =>
                            setReplyBody(event.target.value)
                          }
                          placeholder={t("replyTo", { name: replyTo.name })}
                          maxLength={1000}
                          autoFocus
                          className="min-h-9 min-w-0 flex-1 rounded-pill border border-border bg-surface-2 px-4 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!replyBody.trim() || postingComment}
                          className="min-h-9 shrink-0 rounded-pill bg-brand px-3.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-55"
                        >
                          {t("sendComment")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTo(null)}
                          aria-label={t("cancelReply")}
                          className="flex min-h-9 shrink-0 items-center justify-center rounded-pill px-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {commentError ? (
            <p role="alert" className="pb-2 text-sm text-danger">
              {commentErrorText(commentError)}
            </p>
          ) : null}

          <form onSubmit={submitComment} className="flex items-center gap-2">
            <Avatar size="xs" name={me.fullName} src={me.avatarUrl} />
            <label htmlFor={`comment-${post.id}`} className="sr-only">
              {t("writeComment")}
            </label>
            <input
              id={`comment-${post.id}`}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={t("writeComment")}
              maxLength={1000}
              className="min-h-10 min-w-0 flex-1 rounded-pill border border-border bg-surface-2 px-4 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || postingComment}
              className="min-h-10 shrink-0 rounded-pill bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-55"
            >
              {t("sendComment")}
            </button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
