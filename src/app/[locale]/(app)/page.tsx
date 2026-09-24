import { PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { PostCard } from "@/features/feed/post-card";
import { listFeedPosts } from "@/features/feed/queries";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

/**
 * The home feed: real posts, newest first. Counts and author info are resolved
 * server-side in four batched queries; each `PostCard` takes over interaction
 * (likes, comments, deletion) from the client.
 */
export default async function HomePage() {
  const viewer = await requireApprovedMember();
  const tHome = await getTranslations("Home");
  const tFeed = await getTranslations("Feed");

  const supabase = await createClient();
  const posts = await listFeedPosts(supabase, viewer.id);

  const avatarUrls = await signedStorageUrls(supabase, [
    viewer.avatar_path,
    ...posts.map((item) => item.author.avatarPath),
  ]);

  return (
    <>
      <h1 className="sr-only">{tHome("title")}</h1>
      <FeedComposer />

      {posts.length === 0 ? (
        <EmptyState
          icon={<PenLine className="size-6" aria-hidden="true" />}
          title={tFeed("emptyTitle")}
          description={tFeed("emptyBody")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((item) => (
            <PostCard
              key={item.post.id}
              post={item.post}
              author={{
                username: item.author.username,
                fullName: item.author.fullName,
                avatarUrl: item.author.avatarPath
                  ? (avatarUrls[item.author.avatarPath] ?? null)
                  : null,
              }}
              me={{
                id: viewer.id,
                fullName: viewer.full_name,
                avatarUrl: viewer.avatar_path
                  ? (avatarUrls[viewer.avatar_path] ?? null)
                  : null,
              }}
              initialLiked={item.likedByMe}
              initialLikeCount={item.likeCount}
              initialCommentCount={item.commentCount}
              canDelete={
                item.post.author_id === viewer.id || viewer.role === "admin"
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
