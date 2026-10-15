/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
export async function getConversationStreak(supabase: SupabaseClient<Database>, conversationId: string): Promise<number> {
  try {
    const { data } = await (supabase as unknown as any).from("conversation_streaks").select("current_streak").eq("conversation_id", conversationId).maybeSingle();
    return (data?.current_streak ?? 0) as number;
  } catch { return 0; }
}
export async function getAppStreak(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  try {
    const { data } = await (supabase as unknown as any).from("app_streaks").select("current_streak").eq("user_id", userId).maybeSingle();
    return (data?.current_streak ?? 0) as number;
  } catch { return 0; }
}
