import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStoryView,
  groupStoryRings,
  hasUnseen,
  isStoryActive,
  neighbourStoryIndex,
  orderStoryItems,
  sortStoryRings,
  storyTimeLeftMs,
  unseenCount,
  type StoryAuthor,
  type StoryItem,
  type StoryRing,
} from "./queries.ts";

const NOW = new Date("2026-09-26T12:00:00.000Z");

function liveness(overrides: Partial<Parameters<typeof isStoryActive>[0]> = {}) {
  return {
    status: "active",
    deleted_at: null,
    expires_at: "2026-09-26T18:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<StoryItem> = {}): StoryItem {
  return {
    id: "story-1",
    mediaKey: "u/1.jpg",
    mimeType: "image/jpeg",
    width: 1080,
    height: 1920,
    caption: null,
    createdAt: "2026-09-26T10:00:00.000Z",
    expiresAt: "2026-09-27T10:00:00.000Z",
    viewerCount: 0,
    viewedByMe: false,
    ...overrides,
  };
}

function ring(overrides: Partial<StoryRing> = {}): StoryRing {
  const author: StoryAuthor = {
    id: "author-1",
    username: "sara",
    fullName: "Sara Ahmed",
    avatarPath: null,
  };

  return {
    author,
    items: [item()],
    isSelf: false,
    latestAt: "2026-09-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("isStoryActive — the 24-hour rule", () => {
  it("keeps a live story", () => {
    assert.equal(isStoryActive(liveness(), NOW), true);
  });

  it("drops a story the moment it expires", () => {
    assert.equal(
      isStoryActive(liveness({ expires_at: "2026-09-26T11:59:59.000Z" }), NOW),
      false,
    );
  });

  it("treats a deleted story as gone even before it expires", () => {
    assert.equal(
      isStoryActive(
        liveness({ status: "deleted", deleted_at: "2026-09-26T11:00:00.000Z" }),
        NOW,
      ),
      false,
    );
  });

  it("refuses a story with an unparseable expiry rather than showing it", () => {
    assert.equal(isStoryActive(liveness({ expires_at: "not-a-date" }), NOW), false);
  });
});

describe("storyTimeLeftMs", () => {
  it("counts down to expiry", () => {
    assert.equal(
      storyTimeLeftMs({ expires_at: "2026-09-26T13:00:00.000Z" }, NOW),
      60 * 60 * 1000,
    );
  });

  it("floors at zero for an expired story (never negative)", () => {
    assert.equal(
      storyTimeLeftMs({ expires_at: "2026-09-25T13:00:00.000Z" }, NOW),
      0,
    );
  });
});

describe("orderStoryItems — playback order", () => {
  it("plays oldest first without mutating the input", () => {
    const items = [
      item({ id: "later", createdAt: "2026-09-26T11:00:00.000Z" }),
      item({ id: "earlier", createdAt: "2026-09-26T09:00:00.000Z" }),
    ];

    const ordered = orderStoryItems(items);

    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ["earlier", "later"],
    );
    assert.equal(items[0].id, "later");
  });
});

describe("unseenCount", () => {
  it("counts only what the viewer has not watched", () => {
    assert.equal(
      unseenCount([
        item({ id: "a", viewedByMe: true }),
        item({ id: "b" }),
        item({ id: "c" }),
      ]),
      2,
    );
    assert.equal(hasUnseen([item({ viewedByMe: true })]), false);
  });
});

describe("sortStoryRings — the tray order", () => {
  it("puts the member's own story first, then unseen, then seen", () => {
    const rings = [
      ring({
        author: { id: "seen", username: "z", fullName: "Seen", avatarPath: null },
        items: [item({ viewedByMe: true })],
        latestAt: "2026-09-26T11:30:00.000Z",
      }),
      ring({
        author: { id: "me", username: "me", fullName: "Me", avatarPath: null },
        isSelf: true,
        items: [item({ viewedByMe: true })],
        latestAt: "2026-09-26T08:00:00.000Z",
      }),
      ring({
        author: { id: "fresh", username: "f", fullName: "Fresh", avatarPath: null },
        latestAt: "2026-09-26T09:00:00.000Z",
      }),
    ];

    assert.deepEqual(
      sortStoryRings(rings).map((entry) => entry.author.id),
      ["me", "fresh", "seen"],
    );
  });

  it("orders unseen rings newest-first", () => {
    const rings = [
      ring({ author: { id: "old", username: "o", fullName: "Old", avatarPath: null }, latestAt: "2026-09-26T07:00:00.000Z" }),
      ring({ author: { id: "new", username: "n", fullName: "New", avatarPath: null }, latestAt: "2026-09-26T11:00:00.000Z" }),
    ];

    assert.deepEqual(
      sortStoryRings(rings).map((entry) => entry.author.id),
      ["new", "old"],
    );
  });
});

describe("groupStoryRings", () => {
  const authors = new Map<string, StoryAuthor>([
    [
      "author-1",
      { id: "author-1", username: "sara", fullName: "Sara", avatarPath: null },
    ],
    [
      "viewer",
      { id: "viewer", username: "me", fullName: "Me", avatarPath: null },
    ],
  ]);

  it("groups one author's stories into a single ring in playback order", () => {
    const rings = groupStoryRings(
      [
        {
          id: "s2",
          authorId: "author-1",
          createdAt: "2026-09-26T11:00:00.000Z",
          expiresAt: "2026-09-27T11:00:00.000Z",
          media: { storage_key: "author-1/2.jpg", mime_type: "image/jpeg", width: 800, height: 800, caption: "hi" },
        },
        {
          id: "s1",
          authorId: "author-1",
          createdAt: "2026-09-26T09:00:00.000Z",
          expiresAt: "2026-09-27T09:00:00.000Z",
          media: { storage_key: "author-1/1.jpg", mime_type: "image/jpeg", width: 800, height: 800, caption: null },
        },
      ],
      authors,
      "viewer",
      new Set(["s1"]),
    );

    assert.equal(rings.length, 1);
    assert.deepEqual(
      rings[0].items.map((entry) => entry.id),
      ["s1", "s2"],
    );
    assert.equal(rings[0].items[0].viewedByMe, true);
    assert.equal(rings[0].items[1].viewedByMe, false);
    assert.equal(rings[0].isSelf, false);
    assert.equal(rings[0].latestAt, "2026-09-26T11:00:00.000Z");
  });

  it("marks the viewer's own ring and never counts their own view", () => {
    const rings = groupStoryRings(
      [
        {
          id: "mine",
          authorId: "viewer",
          createdAt: "2026-09-26T10:00:00.000Z",
          expiresAt: "2026-09-27T10:00:00.000Z",
          media: { storage_key: "viewer/1.jpg", mime_type: "image/png", width: 200, height: 200, caption: null },
        },
      ],
      authors,
      "viewer",
      new Set(),
    );

    assert.equal(rings[0].isSelf, true);
    assert.equal(rings[0].items[0].viewerCount, 0);
  });

  it("skips rows whose photo or author is unavailable instead of rendering blanks", () => {
    const rings = groupStoryRings(
      [
        {
          id: "no-photo",
          authorId: "author-1",
          createdAt: "2026-09-26T10:00:00.000Z",
          expiresAt: "2026-09-27T10:00:00.000Z",
          media: null,
        },
        {
          id: "ghost-author",
          authorId: "deleted-member",
          createdAt: "2026-09-26T10:00:00.000Z",
          expiresAt: "2026-09-27T10:00:00.000Z",
          media: { storage_key: "x/1.jpg", mime_type: "image/jpeg", width: 300, height: 300, caption: null },
        },
      ],
      authors,
      "viewer",
      new Set(),
    );

    assert.deepEqual(rings, []);
  });
});

describe("neighbourStoryIndex — navigation", () => {
  it("walks forward and back inside a ring", () => {
    assert.equal(neighbourStoryIndex(0, 3, "next"), 1);
    assert.equal(neighbourStoryIndex(2, 3, "previous"), 1);
  });

  it("returns null at the edges so the viewer can move to another ring", () => {
    assert.equal(neighbourStoryIndex(2, 3, "next"), null);
    assert.equal(neighbourStoryIndex(0, 3, "previous"), null);
  });

  it("returns null for an empty ring", () => {
    assert.equal(neighbourStoryIndex(0, 0, "next"), null);
  });
});

describe("applyStoryView", () => {
  it("marks the story seen and adopts the author's count", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    const next = applyStoryView(items, "a", 7);

    assert.equal(next[0].viewedByMe, true);
    assert.equal(next[0].viewerCount, 7);
    assert.equal(next[1].viewedByMe, false);
    assert.equal(items[0].viewedByMe, false);
  });

  it("never lowers a count and ignores the 0 a non-author receives", () => {
    const items = [item({ id: "a", viewerCount: 4, viewedByMe: false })];

    assert.equal(applyStoryView(items, "a", 0)[0].viewerCount, 4);
    assert.equal(applyStoryView(items, "a", 2)[0].viewerCount, 4);
    assert.equal(applyStoryView(items, "a", 9)[0].viewerCount, 9);
  });
});
