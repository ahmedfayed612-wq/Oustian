import { cache } from "react";
import { getLocale } from "next-intl/server";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";
import { headlineForMember } from "@/lib/profile-options";
import { listSuggestedMembers } from "./queries";
import {
  SUGGESTION_POOL_SIZE,
  type SuggestedPerson,
} from "./suggestions";

/**
 * Who to introduce this request, resolved once.
 *
 * Both surfaces that show suggestions — the desktop right rail and the feed
 * modules on smaller screens — read from here, so opening the home page costs
 * one candidates query, not two. `cache` makes that a per-request memo, the
 * same mechanism `requireApprovedMember()` uses for the session.
 */
export type SuggestedCandidate = {
  id: string;
  username: string;
  fullName: string;
  /** Storage path; the caller turns it into a signed URL. */
  avatarPath: string | null;
  /** Faculty · year when the member filled them in, else null. */
  headline: string | null;
};

export const getSuggestedCandidates = cache(
  async (): Promise<SuggestedCandidate[]> => {
    const viewer = await requireApprovedMember();
    const locale = await getLocale();
    const supabase = await createClient();

    const members = await listSuggestedMembers(
      supabase,
      viewer.id,
      SUGGESTION_POOL_SIZE,
    );

    return members.map((member) => ({
      id: member.id,
      username: member.username,
      fullName: member.full_name,
      avatarPath: member.avatar_path,
      headline: headlineForMember(
        member.faculty,
        member.graduation_year,
        locale,
      ),
    }));
  },
);

/**
 * The render shape, given already-signed avatar URLs. Pure, so a caller that
 * is signing its own batch (the home feed) can fold the suggestion avatars into
 * that one Storage call instead of paying a second round trip.
 */
export function toSuggestedPeople(
  candidates: readonly SuggestedCandidate[],
  avatarUrls: Record<string, string>,
): SuggestedPerson[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    username: candidate.username,
    fullName: candidate.fullName,
    avatarUrl: candidate.avatarPath
      ? (avatarUrls[candidate.avatarPath] ?? null)
      : null,
    headline: candidate.headline,
  }));
}

/**
 * Candidates plus their signed avatar URLs — the shape a component needs when
 * it is not already signing a batch (the right rail).
 */
export const getSuggestedPeople = cache(
  async (): Promise<SuggestedPerson[]> => {
    const candidates = await getSuggestedCandidates();

    if (candidates.length === 0) return [];

    const supabase = await createClient();
    const avatarUrls = await signedStorageUrls(
      supabase,
      candidates.map((candidate) => candidate.avatarPath),
    );

    return toSuggestedPeople(candidates, avatarUrls);
  },
);
