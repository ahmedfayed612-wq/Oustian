/**
 * Presentation-group capacity rules — one source of truth for the UI.
 *
 * The database enforces the same limits under a row lock (`FOR UPDATE` in
 * `invite_to_presentation_group` / `respond_presentation_group_invitation`),
 * so these helpers only drive optimistic UI: disabled buttons, capped
 * pickers and the "{count}/10" chips.
 */

/** Hard cap per group — mirrors the Postgres check. */
export const MAX_GROUP_MEMBERS = 10;

/** How many invitees the creator may add when creating the group (owner takes spot 1). */
export const MAX_INITIAL_INVITEES = MAX_GROUP_MEMBERS - 1;

/** Spots still open for `memberCount` current members. Never negative. */
export function remainingSpots(memberCount: number): number {
  if (!Number.isFinite(memberCount) || memberCount < 0) return 0;
  return Math.max(0, MAX_GROUP_MEMBERS - Math.floor(memberCount));
}

/** May one more member join right now? */
export function canAddMember(memberCount: number): boolean {
  return remainingSpots(memberCount) > 0;
}

/**
 * Cap an invitee selection: keeps order, drops duplicates, never exceeds
 * `memberCount + picked + 1 <= MAX_GROUP_MEMBERS` (the +1 is the inviter,
 * who is already a member — so simply picked < remaining spots).
 */
export function capInvitees(
  current: string[],
  candidate: string,
  memberCount: number,
): string[] {
  if (current.includes(candidate)) {
    return current.filter((id) => id !== candidate);
  }
  if (current.length >= remainingSpots(memberCount)) return current;
  return [...current, candidate];
}
