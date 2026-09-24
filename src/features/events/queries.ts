import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type EventItem = {
  event: Tables<"events">;
  goingCount: number;
  myRsvp: boolean;
};

/**
 * Upcoming events (starting within the last 12 hours still count as
 * "happening now") with RSVP counts resolved in one batch — same shape as the
 * feed's like counts.
 */
export async function listUpcomingEvents(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  limit = 30,
): Promise<EventItem[]> {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[events] read failed", error.message);
    return [];
  }

  if (!events || events.length === 0) return [];

  const eventIds = events.map((event) => event.id);

  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id, user_id")
    .in("event_id", eventIds);

  const counts = new Map<string, number>();
  const mine = new Set<string>();

  for (const rsvp of rsvps ?? []) {
    counts.set(rsvp.event_id, (counts.get(rsvp.event_id) ?? 0) + 1);
    if (rsvp.user_id === viewerId) mine.add(rsvp.event_id);
  }

  return events.map((event) => ({
    event,
    goingCount: counts.get(event.id) ?? 0,
    myRsvp: mine.has(event.id),
  }));
}
