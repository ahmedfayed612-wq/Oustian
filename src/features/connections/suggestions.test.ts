import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFeedTimeline,
  SUGGESTION_INTERVAL,
  SUGGESTION_MODULE_SIZE,
  type SuggestedPerson,
} from "./suggestions.ts";

const posts = Array.from({ length: 12 }, (_, index) => `post-${index}`);

function people(count: number): SuggestedPerson[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `person-${index}`,
    username: `member${index}`,
    fullName: `Member ${index}`,
    avatarUrl: null,
    headline: null,
  }));
}

function modules(timeline: ReturnType<typeof buildFeedTimeline<string>>) {
  return timeline.filter((entry) => entry.kind === "suggestions");
}

describe("feed suggestion placement", () => {
  it("keeps the configured defaults", () => {
    assert.equal(SUGGESTION_INTERVAL, 3);
    assert.equal(SUGGESTION_MODULE_SIZE, 3);
  });

  it("inserts a module after every interval of posts", () => {
    const timeline = buildFeedTimeline(posts, people(9));

    // Count the posts that precede each module: they must sit on the interval
    // grid (3, 6, 9) — never earlier, never bunched together.
    const postsBefore: number[] = [];
    let seen = 0;

    for (const entry of timeline) {
      if (entry.kind === "post") seen += 1;
      else postsBefore.push(seen);
    }

    assert.deepEqual(postsBefore, [3, 6, 9]);
  });

  it("never ends the feed on a module", () => {
    // Exactly one module's worth of people and three posts: the only grid point
    // is the last post, so nothing is inserted.
    const timeline = buildFeedTimeline(posts.slice(0, 3), people(3));
    assert.equal(modules(timeline).length, 0);

    // Six posts: the module lands in the middle, not at the end.
    const six = buildFeedTimeline(posts.slice(0, 6), people(3));
    const last = six[six.length - 1];
    assert.equal(last.kind, "post");
    assert.equal(modules(six).length, 1);
  });

  it("never shows the same person twice across modules", () => {
    const timeline = buildFeedTimeline(posts, people(9));
    const ids = modules(timeline).flatMap((entry) =>
      entry.people.map((person) => person.id),
    );

    assert.equal(ids.length, 9);
    assert.equal(new Set(ids).size, 9);
  });

  it("stops inserting once the pool is exhausted", () => {
    const timeline = buildFeedTimeline(posts, people(4));

    // Two modules: three people, then the remaining one.
    const found = modules(timeline);
    assert.equal(found.length, 2);
    assert.deepEqual(
      found.map((entry) => entry.people.length),
      [3, 1],
    );
  });

  it("renders posts only when there is nobody to suggest", () => {
    const timeline = buildFeedTimeline(posts, []);

    assert.equal(timeline.length, posts.length);
    assert.equal(modules(timeline).length, 0);
  });

  it("drops duplicate people in the pool", () => {
    const duplicated = [...people(3), ...people(3)];
    const timeline = buildFeedTimeline(posts, duplicated);

    assert.equal(modules(timeline)[0]?.people.length, 3);
  });

  it("honours an overridden interval", () => {
    const timeline = buildFeedTimeline(posts, people(6), { interval: 1 });
    const last = timeline[timeline.length - 1];

    // Every post is followed by a module (except the final post), and it is
    // still not allowed to end the feed.
    assert.equal(last.kind, "post");
    assert.equal(modules(timeline).length, 2);
  });

  it("keeps the feed empty when there are no posts", () => {
    assert.deepEqual(buildFeedTimeline([], people(6)), []);
  });
});
