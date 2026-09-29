import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
/** Story lifetime. The database default repeats this as `now() + 24 hours`. */
export const STORY_TTL_HOURS = 24;

/** Story lifetime in ms, mirroring the `expires_at` default in SQL. */
export const STORY_TTL_MS = STORY_TTL_HOURS * 60 * 60 * 1000;

/** Only what "alive" needs, so tests never build a whole row. */
export type StoryLiveness = {
  status: string;
  deleted_at: string | null;
  expires_at: string;
};

export type StoryItem = {
  id: string;
  mediaKey: string;
  mimeType: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  /** Watchers, excluding the author. Only populated for the author's own. */
  viewerCount: number;
  /** Has the *viewer* already watched this item? */
  viewedByMe: boolean;
};

export type StoryAuthor = {
  id: string;
  username: string;
  fullName: string;
  avatarPath: string | null;
};

/** One avatar in the tray: an author and everything they posted today. */
export type StoryRing = {
  author: StoryAuthor;
  /** Chronological: oldest first, which is playback order too. */
  items: StoryItem[];
  /** The author is the member looking at the tray. */
  isSelf: boolean;
  /** Newest item, used for ordering the tray. */
  latestAt: string;
};

export type StoryViewerRow = {
  id: string;
  username: string;
  fullName: string;
  avatarPath: string | null;
  viewedAt: string;
};

/** Is this story still visible? Expiry and deletion are both decisive. */
export function isStoryActive(
  story: StoryLiveness,
  now: Date = new Date(),
): boolean {
  if (story.status !== "active") return false;
  if (story.deleted_at) return false;

  const expiresAt = Date.parse(story.expires_at);
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt > now.getTime();
}

/** Milliseconds until expiry, floored at zero (used for "expires in 3h"). */
export function storyTimeLeftMs(
  story: Pick<StoryLiveness, "expires_at">,
  now: Date = new Date(),
): number {
  const expiresAt = Date.parse(story.expires_at);
  if (Number.isNaN(expiresAt)) return 0;

  return Math.max(0, expiresAt - now.getTime());
}

/** Playback order: stories are watched in the order they were posted. */
export function orderStoryItems(items: StoryItem[]): StoryItem[] {
  return [...items].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

/**
 * Is this story's media a clip? `story_media.mime_type` is the authoritative
 * record (the server sniffed the bytes), so the viewer never has to guess from
 * a file name — the same rule sizes the frame and picks `<video>` vs `<img>`.
 */
export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function unseenCount(items: StoryItem[]): number {
  return items.filter((item) => !item.viewedByMe).length;
}

export function hasUnseen(items: StoryItem[]): boolean {
  return unseenCount(items) > 0;
}

/**
 * Tray order: the member's own ring first (it is also the "Add story" entry),
 * then rings with something unwatched, then fully-seen rings — each group
 * newest-first, so a new story always floats to the top of its group.
 */
export function sortStoryRings(rings: StoryRing[]): StoryRing[] {
  return [...rings].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;

    const aUnseen = hasUnseen(a.items);
    const bUnseen = hasUnseen(b.items);
    if (aUnseen !== bUnseen) return aUnseen ? -1 : 1;

    return Date.parse(b.latestAt) - Date.parse(a.latestAt);
  });
}

/** The flat shape `groupStoryRings` consumes (one row per story + its photo). */
export type StoryRow = {
  id: string;
  authorId: string;
  createdAt: string;
  expiresAt: string;
  media: {
    storage_key: string;
    mime_type: string;
    width: number;
    height: number;
    caption: string | null;
  } | null;
};

/**
 * Groups flat story rows into per-author rings. `viewedStoryIds` comes from
 * the viewer's own `story_views` rows, so "seen" is per member, never global.
 */
export function groupStoryRings(
  rows: StoryRow[],
  authors: Map<string, StoryAuthor>,
  viewerId: string,
  viewedStoryIds: ReadonlySet<string>,
): StoryRing[] {
  const rings = new Map<string, StoryRing>();

  for (const row of rows) {
    // A story without its photo cannot be painted: skip rather than render an
    // empty frame (only reachable mid-transaction).
    if (!row.media) continue;

    const author = authors.get(row.authorId);
    if (!author) continue;

    const ring = rings.get(row.authorId) ?? {
      author,
      items: [],
      isSelf: row.authorId === viewerId,
      latestAt: row.createdAt,
    };

    ring.items.push({
      id: row.id,
      mediaKey: row.media.storage_key,
      mimeType: row.media.mime_type,
      width: row.media.width,
      height: row.media.height,
      caption: row.media.caption,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      viewerCount: 0,
      viewedByMe: viewedStoryIds.has(row.id),
    });

    if (Date.parse(row.createdAt) > Date.parse(ring.latestAt)) {
      ring.latestAt = row.createdAt;
    }

    rings.set(row.authorId, ring);
  }

  for (const ring of rings.values()) {
    ring.items = orderStoryItems(ring.items);
  }

  return sortStoryRings([...rings.values()]);
}

/**
 * Viewer navigation. Returns the neighbouring index, or null when the
 * neighbour lives in another ring — the viewer then moves to that ring rather
 * than wrapping inside one author, which is what members expect.
 */
export function neighbourStoryIndex(
  index: number,
  length: number,
  direction: "next" | "previous",
): number | null {
  if (length <= 0) return null;

  const target = direction === "next" ? index + 1 : index - 1;
  if (target < 0 || target >= length) return null;

  return target;
}

/**
 * Folds one recorded watch into the item list: the item flips to seen and the
 * author's count adopts what Postgres returned. Pure, so the viewer can paint
 * optimistically and the tests can assert the exact transition.
 */
export function applyStoryView<T extends StoryItem>(
  items: T[],
  storyId: string,
  viewerCount: number,
): T[] {
  return items.map((item) =>
    item.id === storyId
      ? {
          ...item,
          viewedByMe: true,
          viewerCount:
            // A viewer may not read someone else's count: the RPC returns 0
            // for non-authors, which must never erase a real number.
            viewerCount > 0 ? Math.max(item.viewerCount, viewerCount) : item.viewerCount,
        }
      : item,
  );
}

type StoryMediaRow = Pick<
  Tables<"story_media">,
  "story_id" | "storage_key" | "mime_type" | "width" | "height" | "caption"
>;

/**
 * Every read below shares one shape: one query for the live stories, one for
 * their photos, one for the authors and one for the view rows. The view query
 * is deliberately unfiltered by viewer id — RLS returns *all* rows for stories
 * the caller authored and only the caller's own row elsewhere, which is
 * exactly the split "how many watched this" versus "have I watched this"
 * needs, with no extra round trip and no way for a viewer to read a stranger's
 * audience.
 */
async function readStoryRows(
  supabase: SupabaseClient<Database>,
  options: { authorId?: string; limit: number },
) {
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("stories")
    .select("id, author_id, created_at, expires_at")
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (options.authorId) query = query.eq("author_id", options.authorId);

  const { data: stories, error } = await query;

  if (error) {
    console.error("[stories] read failed", error.message);
    return null;
  }

  const rows = stories ?? [];
  if (rows.length === 0) return { stories: rows, media: [], views: [] };

  const storyIds = rows.map((story) => story.id);

  const [mediaResult, viewsResult] = await Promise.all([
    supabase
      .from("story_media")
      .select("story_id, storage_key, mime_type, width, height, caption")
      .in("story_id", storyIds),
    // See the note above: RLS decides how much of this the caller may see.
    supabase
      .from("story_views")
      .select("story_id, viewer_id")
      .in("story_id", storyIds),
  ]);

  if (mediaResult.error) {
    console.error("[stories] media read failed", mediaResult.error.message);
  }

  return {
    stories: rows,
    media: (mediaResult.data ?? []) as StoryMediaRow[],
    views: viewsResult.data ?? [],
  };
}

/** Author profiles for a set of ids, as the tray and the viewer need them. */
async function readStoryAuthors(
  supabase: SupabaseClient<Database>,
  authorIds: string[],
): Promise<Map<string, StoryAuthor>> {
  if (authorIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path")
    .in("id", authorIds);

  if (error) {
    console.error("[stories] author read failed", error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((person) => [
      person.id,
      {
        id: person.id,
        username: person.username,
        fullName: person.full_name,
        avatarPath: person.avatar_path,
      },
    ]),
  );
}

/**
 * The tray: one ring per author, own story first, then unseen, then seen.
 * Avatars are signed by the page in one batch, so this returns paths only.
 */
export async function listStoryTray(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  limit = 100,
): Promise<StoryRing[]> {
  const data = await readStoryRows(supabase, { limit });
  if (!data) return [];

  const authors = await readStoryAuthors(supabase, [
    ...new Set(data.stories.map((story) => story.author_id)),
  ]);

  const mediaByStory = new Map(data.media.map((item) => [item.story_id, item]));
  const viewedIds = new Set(
    data.views
      .filter((row) => row.viewer_id === viewerId)
      .map((row) => row.story_id),
  );

  return groupStoryRings(
    data.stories.map((story) => ({
      id: story.id,
      authorId: story.author_id,
      createdAt: story.created_at,
      expiresAt: story.expires_at,
      media: mediaByStory.get(story.id) ?? null,
    })),
    authors,
    viewerId,
    viewedIds,
  );
}

/**
 * One author's live stories, chronological (playback order), with the viewer's
 * own seen flags and — for the author — the real audience sizes.
 */
export async function listAuthorStories(
  supabase: SupabaseClient<Database>,
  authorId: string,
  viewerId: string,
  limit = 50,
): Promise<StoryItem[]> {
  const data = await readStoryRows(supabase, { authorId, limit });
  if (!data) return [];

  const mediaByStory = new Map(data.media.map((item) => [item.story_id, item]));
  const viewerCounts = new Map<string, number>();
  const viewedIds = new Set<string>();

  for (const row of data.views) {
    if (row.viewer_id === viewerId) viewedIds.add(row.story_id);
    // The author is never recorded, so every row here is a real watcher.
    if (row.viewer_id !== authorId) {
      viewerCounts.set(row.story_id, (viewerCounts.get(row.story_id) ?? 0) + 1);
    }
  }

  return orderStoryItems(
    data.stories.flatMap((story) => {
      const media = mediaByStory.get(story.id);
      if (!media) return [];

      return [
        {
          id: story.id,
          mediaKey: media.storage_key,
          mimeType: media.mime_type,
          width: media.width,
          height: media.height,
          caption: media.caption,
          createdAt: story.created_at,
          expiresAt: story.expires_at,
          viewerCount: viewerCounts.get(story.id) ?? 0,
          viewedByMe: viewedIds.has(story.id),
        },
      ];
    }),
  );
}

/**
 * Who watched one story, newest first. The `story_views_select` policy returns
 * rows only to the story's author, so this cannot leak an audience to anyone
 * else even if a story id is guessed.
 */
export async function listStoryViewers(
  supabase: SupabaseClient<Database>,
  storyId: string,
  limit = 100,
): Promise<StoryViewerRow[]> {
  const { data: views, error } = await supabase
    .from("story_views")
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[stories] viewer read failed", error.message);
    return [];
  }

  if (!views || views.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path")
    .in(
      "id",
      views.map((row) => row.viewer_id),
    );

  const byId = new Map((profiles ?? []).map((person) => [person.id, person]));

  return views
    .map((row) => {
      const person = byId.get(row.viewer_id);
      if (!person) return null;

      return {
        id: person.id,
        username: person.username,
        fullName: person.full_name,
        avatarPath: person.avatar_path,
        viewedAt: row.viewed_at,
      };
    })
    .filter((row): row is StoryViewerRow => Boolean(row));
}



