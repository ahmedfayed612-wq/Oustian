import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

/**
 * Connection reads. All writes go through `set_connection()` (see
 * `actions.ts`) — this module only answers "what is my state with X",
 * "how many connections does X have", "who asked me" and "who should I
 * be introduced to".
 */

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The viewer's relationship with another member, as the button sees it. */
export type ConnectionState = "none" | "outgoing" | "incoming" | "connected";

export type MemberCard = Pick<
  Tables<"profiles">,
  "id" | "username" | "full_name" | "avatar_path"
>;

/**
 * A suggested member carries the faculty and graduation year too: the feed
 * module and the right rail show "Engineering · 2027" under the name, which is
 * the only context that makes an introduction useful on a campus network.
 */
export type SuggestedMember = MemberCard &
  Pick<Tables<"profiles">, "faculty" | "graduation_year">;

/** One indexed row read: the pair row between the viewer and `otherId`. */
export async function getConnectionState(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  otherId: string,
): Promise<ConnectionState> {
  const { data, error } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${viewerId})`,
    )
    .maybeSingle();

  if (error) {
    console.error("[connections] state read failed", error.message);
    return "none";
  }

  if (!data) return "none";
  if (data.status === "accepted") return "connected";
  return data.requester_id === viewerId ? "outgoing" : "incoming";
}

/** Accepted connections for a profile — the LinkedIn-style count. */
export async function listConnectionCount(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);

  if (error) {
    console.error("[connections] count read failed", error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Accepted connections for a profile — newest first. Powers the clickable
 * connections-count sheet. RLS already limits rows to approved members, so
 * both directions are resolved to "the other member" here.
 */
export async function listConnectedMembers(
  supabase: SupabaseClient<Database>,
  profileId: string,
  limit = 50,
): Promise<MemberCard[]> {
  const { data: links, error } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, responded_at, created_at")
    .eq("status", "accepted")
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .order("responded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[connections] list read failed", error.message);
    return [];
  }

  if (!links || links.length === 0) return [];

  const otherIds = [
    ...new Set(
      links.map((link) =>
        link.requester_id === profileId
          ? link.addressee_id
          : link.requester_id,
      ),
    ),
  ];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path")
    .in("id", otherIds);

  if (profilesError) {
    console.error("[connections] list profiles failed", profilesError.message);
    return [];
  }

  const byId = new Map((profiles ?? []).map((person) => [person.id, person]));

  // Keep the newest-first order of the links query.
  return otherIds
    .map((id) => byId.get(id))
    .filter((person): person is MemberCard => Boolean(person));
}

/**
 * Members who asked the viewer for a connection, newest first — the list the
 * own-profile screen answers. RLS limits rows to approved members anyway;
 * the join resolves requesters that are still visible.
 */
export async function listIncomingRequests(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  limit = 5,
): Promise<MemberCard[]> {
  const { data: links, error } = await supabase
    .from("connections")
    .select("requester_id, created_at")
    .eq("addressee_id", viewerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[connections] requests read failed", error.message);
    return [];
  }

  if (!links || links.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_path")
    .in(
      "id",
      links.map((link) => link.requester_id),
    );

  const byId = new Map((profiles ?? []).map((person) => [person.id, person]));

  // Keep the newest-first order of the links query.
  return links
    .map((link) => byId.get(link.requester_id))
    .filter((person): person is MemberCard => Boolean(person));
}

/**
 * "People you may know": approved members with no connection row at all
 * (pending or accepted, either direction), newest members first — that is
 * when an introduction matters most. A bounded candidate page is filtered
 * in memory so the query never grows with the viewer's friend count.
 */
export async function listSuggestedMembers(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  limit = 5,
): Promise<SuggestedMember[]> {
  const [linksResult, peopleResult] = await Promise.all([
    supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`),
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_path, faculty, graduation_year",
      )
      .eq("status", "approved")
      .neq("id", viewerId)
      .order("created_at", { ascending: false })
      .limit(limit * 5),
  ]);

  const exclude = new Set(
    (linksResult.data ?? []).flatMap((link) => [
      link.requester_id,
      link.addressee_id,
    ]),
  );

  return (peopleResult.data ?? [])
    .filter((person) => !exclude.has(person.id))
    .slice(0, limit);
}
