import { PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { PostCard } from "@/features/feed/post-card";
import { listFeedPosts, rankFeedPosts } from "@/features/feed/queries";
import { listStoryTray, unseenCount } from "@/features/stories/queries";
import { StoryTray } from "@/features/stories/story-tray";
import { createClient } from "@/lib/supabase/server";
import { signedPostMediaUrls, signedStorageUrls } from "@/lib/supabase/storage";

/**
 * The home feed: real posts, newest first. Counts and author info are resolved
 * server-side in four batched queries; each `PostCard` takes over interaction
 * (likes, comments, deletion) from the client.
 *
 * Stories open the screen — the rail is resolved from the same request's
 * Supabase client, so its rows are already limited by `can_view_story()`, and
 * every avatar in it is signed in the same batch as the feed's.
 */
export default async function HomePage() {
  const viewer = await requireApprovedMember();
  const tHome = await getTranslations("Home");
  const tFeed = await getTranslations("Feed");

  const supabase = await createClient();
  // Ranked: weighted reactions plus comments, tempered by recency.
  const [posts, storyRings] = await Promise.all([
    listFeedPosts(supabase, viewer.id).then(rankFeedPosts),
    listStoryTray(supabase, viewer.id),
  ]);

  // Extract all media keys across every post to sign them in a single batch
  const allMediaKeys = posts.flatMap((p) => p.media.map((m) => m.storageKey));

  const [avatarUrls, mediaUrls] = await Promise.all([
    signedStorageUrls(supabase, [
      viewer.avatar_path,
      ...posts.map((item) => item.author.avatarPath),
      ...storyRings.map((ring) => ring.author.avatarPath),
    ]),
    signedPostMediaUrls(supabase, allMediaKeys),
  ]);

  const viewerAvatarUrl = viewer.avatar_path
    ? (avatarUrls[viewer.avatar_path] ?? null)
    : null;

  return (
    <>
      <h1 className="sr-only">{tHome("title")}</h1>

      <StoryTray
        meId={viewer.id}
        meFullName={viewer.full_name}
        meAvatarUrl={viewerAvatarUrl}
        rings={storyRings.map((ring) => ({
          authorId: ring.author.id,
          username: ring.author.username,
          fullName: ring.author.fullName,
          avatarUrl: ring.author.avatarPath
            ? (avatarUrls[ring.author.avatarPath] ?? null)
            : null,
          isSelf: ring.isSelf,
          unseenCount: unseenCount(ring.items),
          itemCount: ring.items.length,
        }))}
      />

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
                roles: item.author.roles,
              }}
              me={{
                id: viewer.id,
                username: viewer.username,
                fullName: viewer.full_name,
                avatarUrl: viewer.avatar_path
                  ? (avatarUrls[viewer.avatar_path] ?? null)
                  : null,
              }}
              media={item.media.map((m) => ({
                id: m.id,
                url: mediaUrls[m.storageKey] ?? "",
                altText: m.altText,
                width: m.width,
                height: m.height,
              }))}
              reactions={item.reactions}
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
