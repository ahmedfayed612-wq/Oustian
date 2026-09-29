import { PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { PostCard } from "@/features/feed/post-card";
import { listFeedPosts, rankFeedPosts } from "@/features/feed/queries";
import {
  getSuggestedCandidates,
  toSuggestedPeople,
} from "@/features/connections/suggested-members";
import { SuggestedConnectionsModule } from "@/features/connections/suggested-connections-module";
import { buildFeedTimeline } from "@/features/connections/suggestions";
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
 *
 * On screens without the right rail, "people you may know" is interleaved into
 * the feed itself (every `SUGGESTION_INTERVAL` posts); the rules live in
 * `features/connections/suggestions.ts` and the people come from the same
 * request-cached query the rail uses, so the page pays for one candidate read.
 */
export default async function HomePage() {
  const viewer = await requireApprovedMember();
  const tHome = await getTranslations("Home");
  const tFeed = await getTranslations("Feed");

  const supabase = await createClient();
  // Ranked: weighted reactions plus comments, tempered by recency.
  const [posts, storyRings, suggestedCandidates] = await Promise.all([
    listFeedPosts(supabase, viewer.id).then(rankFeedPosts),
    listStoryTray(supabase, viewer.id),
    getSuggestedCandidates(),
  ]);

  // Extract all media keys across every post to sign them in a single batch
  const allMediaKeys = posts.flatMap((p) => p.media.map((m) => m.storageKey));

  const [avatarUrls, mediaUrls] = await Promise.all([
    signedStorageUrls(supabase, [
      viewer.avatar_path,
      ...posts.map((item) => item.author.avatarPath),
      ...storyRings.map((ring) => ring.author.avatarPath),
      ...suggestedCandidates.map((person) => person.avatarPath),
    ]),
    signedPostMediaUrls(supabase, allMediaKeys),
  ]);

  const viewerAvatarUrl = viewer.avatar_path
    ? (avatarUrls[viewer.avatar_path] ?? null)
    : null;

  const timeline = buildFeedTimeline(
    posts,
    toSuggestedPeople(suggestedCandidates, avatarUrls),
  );

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
          {timeline.map((entry) =>
            entry.kind === "suggestions" ? (
              // The rail owns this on xl and wider — one suggestion surface per
              // screen size, never both.
              <div key={entry.key} className="xl:hidden">
                <SuggestedConnectionsModule people={entry.people} />
              </div>
            ) : (
              <PostCard
                key={entry.post.post.id}
                post={entry.post.post}
                author={{
                  username: entry.post.author.username,
                  fullName: entry.post.author.fullName,
                  avatarUrl: entry.post.author.avatarPath
                    ? (avatarUrls[entry.post.author.avatarPath] ?? null)
                    : null,
                  roles: entry.post.author.roles,
                }}
                me={{
                  id: viewer.id,
                  username: viewer.username,
                  fullName: viewer.full_name,
                  avatarUrl: viewer.avatar_path
                    ? (avatarUrls[viewer.avatar_path] ?? null)
                    : null,
                }}
                media={entry.post.media.map((m) => ({
                  id: m.id,
                  url: mediaUrls[m.storageKey] ?? "",
                  altText: m.altText,
                  width: m.width,
                  height: m.height,
                }))}
                reactions={entry.post.reactions}
                initialCommentCount={entry.post.commentCount}
                canDelete={
                  entry.post.post.author_id === viewer.id ||
                  viewer.role === "admin"
                }
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
