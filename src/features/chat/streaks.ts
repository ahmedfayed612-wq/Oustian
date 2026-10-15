/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** UTC calendar day key (YYYY-MM-DD) — matches how activity days are stored. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive active days for a conversation, computed from the messages
 * themselves (UTC days, same basis the streak triggers use).
 *
 * Deriving from `messages` instead of reading `conversation_streaks` makes the
 * badge robust: it is correct even if the streak migrations were never pushed,
 * and it can never drift from the data it describes. The streak is "alive" if
 * the last active day is today or yesterday; a longer gap returns 0.
 */
export async function getConversationStreak(
  supabase: SupabaseClient<Database>,
  conversationId: string,
): Promise<number> {
  try {
    const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return 0;

    const days = [...new Set((data ?? []).map((r: { created_at: string }) => dayKey(new Date(r.created_at))))];
    if (days.length === 0) return 0;

    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (days[0] !== today && days[0] !== yesterday) return 0;

    let streak = 0;
    let expected = days[0];
    for (const day of days) {
      if (day !== expected) break;
      streak += 1;
      expected = dayKey(new Date(new Date(`${expected}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000));
    }
    return streak;
  } catch {
    return 0;
  }
}

/** Signed-in member's own app-visit streak (from `app_streaks`). */
export async function getAppStreak(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  try {
    const { data } = await (supabase as unknown as any)
      .from("app_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.current_streak ?? 0) as number;
  } catch {
    return 0;
  }
}
