/**
 * Where "people you may know" appears in the feed.
 *
 * The desktop rail shows the suggestions rail; on a phone there is no third
 * column, so the same people are interleaved *inside* the feed the way
 * Facebook does it. Both read the same source (`listSuggestedMembers`) — this
 * module only decides placement, and it is pure so the rules can be tested
 * rather than eyeballed.
 *
 * The frequency lives here, not in the page: `SUGGESTION_INTERVAL` is the
 * number of posts between two modules, so `3` reads "a module after every
 * third post".
 */

/** Posts per suggestion module. Three is roughly one phone screen. */
export const SUGGESTION_INTERVAL = 3;

/** People shown in one module. */
export const SUGGESTION_MODULE_SIZE = 3;

/**
 * How many people the server should fetch. Deliberately small: every candidate
 * is a profile read, and the feed module should never be the reason a page gets
 * slower. It also caps the number of modules a single feed can carry.
 */
export const SUGGESTION_POOL_SIZE = 12;

/** Who goes in a module — the card's own fields, already resolved. */
export type SuggestedPerson = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  /** Faculty · year when the member has filled them in, else null. */
  headline: string | null;
};

export type FeedTimelineEntry<Post> =
  | { kind: "post"; key: string; post: Post }
  | { kind: "suggestions"; key: string; people: SuggestedPerson[] };

/**
 * Interleaves modules of suggestions into a list of posts.
 *
 * Rules, all of them deliberate:
 *  - a module lands after every `interval` posts (the first one after the third
 *    post, never before the member has scrolled anything);
 *  - the last position is never a module, so a feed never ends on an
 *    advertisement — there is always another post to scroll into;
 *  - people are handed out in order and **never repeat**: a module consumes its
 *    slice of the pool, and when the pool is exhausted no further module is
 *    rendered (the feed simply continues with posts) rather than showing the
 *    same faces twice.
 */
export function buildFeedTimeline<Post>(
  posts: readonly Post[],
  people: readonly SuggestedPerson[],
  options?: { interval?: number; moduleSize?: number },
): FeedTimelineEntry<Post>[] {
  const interval = Math.max(1, options?.interval ?? SUGGESTION_INTERVAL);
  const moduleSize = Math.max(1, options?.moduleSize ?? SUGGESTION_MODULE_SIZE);

  const pool = dedupeById(people);
  const modules = chunk(pool, moduleSize);

  const timeline: FeedTimelineEntry<Post>[] = [];
  let nextModule = 0;

  posts.forEach((post, index) => {
    timeline.push({ kind: "post", key: `post-${index}`, post });

    const onGrid = (index + 1) % interval === 0;
    const postsFollow = index < posts.length - 1;
    const nextGroup = modules[nextModule];

    if (onGrid && postsFollow && nextGroup) {
      timeline.push({
        kind: "suggestions",
        key: `suggestions-${nextModule}`,
        people: nextGroup,
      });
      nextModule += 1;
    }
  });

  return timeline;
}

/** One person appears once, no matter what the pool contained. */
function dedupeById(
  people: readonly SuggestedPerson[],
): SuggestedPerson[] {
  const seen = new Set<string>();
  const unique: SuggestedPerson[] = [];

  for (const person of people) {
    if (seen.has(person.id)) continue;

    seen.add(person.id);
    unique.push(person);
  }

  return unique;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}
