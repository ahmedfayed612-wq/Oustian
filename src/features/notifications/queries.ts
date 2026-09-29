import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Notification reads for the chrome.
 *
 * The inbox page has always read its own rows; the header bell needs one number
 * from the same table. That number is resolved here rather than in the page, so
 * the badge is correct on every screen — and it degrades to zero on failure:
 * a notification count must never be able to take the header down.
 */

/** Unread rows for one member. Backed by `notifications_unread_idx`. */
export async function countUnreadNotifications(
  supabase: SupabaseClient<Database>,
  recipientId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .is("read_at", null);

  if (error) {
    console.error("[notifications] unread count failed", error.message);
    return 0;
  }

  return count ?? 0;
}

/** The signed-in member's unread count, resolved once per request. */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const viewer = await requireApprovedMember();
  const supabase = await createClient();

  return countUnreadNotifications(supabase, viewer.id);
});
