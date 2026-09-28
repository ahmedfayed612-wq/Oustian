import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddMember,
  capInvitees,
  MAX_GROUP_MEMBERS,
  MAX_INITIAL_INVITEES,
  remainingSpots,
} from "./capacity.ts";

describe("presentation group capacity", () => {
  it("caps the group at 10 members and initial invitees at 9", () => {
    assert.equal(MAX_GROUP_MEMBERS, 10);
    assert.equal(MAX_INITIAL_INVITEES, 9);
  });

  it("counts remaining spots from the current member count", () => {
    assert.equal(remainingSpots(0), 10);
    assert.equal(remainingSpots(1), 9);
    assert.equal(remainingSpots(9), 1);
    assert.equal(remainingSpots(10), 0);
    assert.equal(remainingSpots(11), 0);
  });

  it("never returns negative spots for bogus counts", () => {
    assert.equal(remainingSpots(-3), 0);
    assert.equal(remainingSpots(Number.NaN), 0);
    // Floored: 2.7 members count as 2 → 8 spots.
    assert.equal(remainingSpots(2.7), 8);
  });

  it("allows joins only while spots remain", () => {
    assert.equal(canAddMember(9), true);
    assert.equal(canAddMember(10), false);
    assert.equal(canAddMember(42), false);
  });

  it("toggles invitees: add when there is room, remove on second tap", () => {
    assert.deepEqual(capInvitees([], "a", 1), ["a"]);
    assert.deepEqual(capInvitees(["a"], "a", 1), []);
  });

  it("refuses new invitees once the invitee budget is spent", () => {
    // memberCount 1 (owner) → 9 invitee spots.
    const full = Array.from({ length: 9 }, (_, index) => `u${index}`);
    assert.deepEqual(capInvitees(full, "extra", 1), full);
  });

  it("reduces the invitee budget as the group fills", () => {
    // 8 members → only 2 spots left: the second pick fits, the third does not.
    assert.deepEqual(capInvitees(["a"], "b", 8), ["a", "b"]);
    assert.deepEqual(capInvitees(["a", "b"], "c", 8), ["a", "b"]);
    // 9 members → 1 spot: a single pick fits.
    assert.deepEqual(capInvitees([], "a", 9), ["a"]);
    assert.deepEqual(capInvitees(["a"], "b", 9), ["a"]);
  });
});
