import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyReactionTap,
  EMPTY_REACTIONS,
  engagementScore,
  isReaction,
  parseReactionTotals,
  REACTION_WEIGHTS,
  reactionRequest,
  type ReactionTotals,
} from "./queries.ts";

function totals(overrides: Partial<ReactionTotals> = {}): ReactionTotals {
  return { ...EMPTY_REACTIONS, ...overrides };
}

describe("isReaction", () => {
  it("accepts exactly the four Oustians reactions", () => {
    for (const reaction of ["fire", "insight", "same", "talk"]) {
      assert.equal(isReaction(reaction), true);
    }
  });

  it("rejects anything else, including the retired like", () => {
    for (const value of ["like", "LOVE", "", null, undefined, 3, {}]) {
      assert.equal(isReaction(value), false);
    }
  });
});

describe("applyReactionTap — create / change / remove", () => {
  it("creates a reaction when the member has none", () => {
    const next = applyReactionTap(totals({ fire: 4, total: 4 }), "same");

    assert.equal(next.userReaction, "same");
    assert.equal(next.same, 1);
    assert.equal(next.total, 5);
    assert.equal(next.fire, 4);
  });

  it("changes an existing reaction without leaving a second one behind", () => {
    const next = applyReactionTap(
      totals({ userReaction: "same", same: 31, total: 31 }),
      "insight",
    );

    assert.equal(next.userReaction, "insight");
    assert.equal(next.same, 30);
    assert.equal(next.insight, 1);
    assert.equal(next.total, 31);
  });

  it("removes the reaction when the active one is tapped again", () => {
    const next = applyReactionTap(
      totals({ userReaction: "talk", talk: 2, total: 2 }),
      "talk",
    );

    assert.equal(next.userReaction, null);
    assert.equal(next.talk, 1);
    assert.equal(next.total, 1);
  });

  it("never drops a count below zero", () => {
    const next = applyReactionTap(
      totals({ userReaction: "fire", fire: 0, total: 0 }),
      "fire",
    );

    assert.equal(next.fire, 0);
    assert.equal(next.total, 0);
  });

  it("keeps the original object untouched (optimistic revert stays possible)", () => {
    const before = totals({ fire: 1, total: 1 });
    const after = applyReactionTap(before, "insight");

    assert.equal(before.fire, 1);
    assert.equal(before.userReaction, null);
    assert.notEqual(before, after);
  });

  it("applies the three states in sequence like the RPC does", () => {
    let state = totals();
    state = applyReactionTap(state, "fire"); // create
    assert.deepEqual(
      { reaction: state.userReaction, fire: state.fire, total: state.total },
      { reaction: "fire", fire: 1, total: 1 },
    );

    state = applyReactionTap(state, "insight"); // change
    assert.deepEqual(
      {
        reaction: state.userReaction,
        fire: state.fire,
        insight: state.insight,
        total: state.total,
      },
      { reaction: "insight", fire: 0, insight: 1, total: 1 },
    );

    state = applyReactionTap(state, "insight"); // remove
    assert.deepEqual(
      { reaction: state.userReaction, insight: state.insight, total: state.total },
      { reaction: null, insight: 0, total: 0 },
    );
  });
});

describe("reactionRequest", () => {
  it("clears when the active reaction is tapped again", () => {
    assert.equal(
      reactionRequest(totals({ userReaction: "fire" }), "fire"),
      "",
    );
  });

  it("sets/changes otherwise", () => {
    assert.equal(reactionRequest(totals(), "talk"), "talk");
    assert.equal(
      reactionRequest(totals({ userReaction: "same" }), "talk"),
      "talk",
    );
  });
});

describe("parseReactionTotals", () => {
  it("reads the RPC payload (jsonb numbers may arrive as strings)", () => {
    const parsed = parseReactionTotals({
      user_reaction: "same",
      fire: "84",
      insight: 31,
      same: "126",
      talk: 18,
      total: "259",
    });

    assert.deepEqual(parsed, {
      userReaction: "same",
      fire: 84,
      insight: 31,
      same: 126,
      talk: 18,
      total: 259,
    });
  });

  it("treats an unknown reaction as none", () => {
    const parsed = parseReactionTotals({ user_reaction: "like", total: 1 });

    assert.equal(parsed.userReaction, null);
  });

  it("falls back to empty totals for junk", () => {
    assert.deepEqual(parseReactionTotals(null), EMPTY_REACTIONS);
    assert.deepEqual(parseReactionTotals("nope"), EMPTY_REACTIONS);
    assert.deepEqual(parseReactionTotals({}), EMPTY_REACTIONS);
  });
});

describe("engagementScore — the feed ranking signal", () => {
  it("weights insight and talk above fire and same", () => {
    const fire = engagementScore(totals({ fire: 1 }));
    const same = engagementScore(totals({ same: 1 }));
    const insight = engagementScore(totals({ insight: 1 }));
    const talk = engagementScore(totals({ talk: 1 }));

    assert.equal(fire, REACTION_WEIGHTS.fire);
    assert.ok(insight > same && same > fire);
    assert.ok(talk > insight);
  });

  it("counts discussion: comments add weight on their own", () => {
    assert.equal(engagementScore(totals(), 4), 4 * REACTION_WEIGHTS.comment);
    assert.equal(
      engagementScore(totals({ fire: 2, talk: 1 }), 3),
      2 * REACTION_WEIGHTS.fire +
        REACTION_WEIGHTS.talk +
        3 * REACTION_WEIGHTS.comment,
    );
  });

  it("is zero for an untouched post", () => {
    assert.equal(engagementScore(totals(), 0), 0);
  });
});
