"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "./queries";

export type ChatActionResult = {
  status: "success" | "error";
  /** Rendered from `Chat.errors.<code>` (plus two shared `Auth.errors` codes). */
  code?: string;
  conversationId?: string;
};

/**
 * Opens — or reuses — the 1:1 thread with another member. The work happens in
 * the idempotent `start_conversation()` Postgres function: asking twice
 * returns the same conversation, so duplicate threads can never stack up.
 */
export async function startConversationAction(
  otherId: string,
): Promise<ChatActionResult> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(otherId) || otherId === viewer.id) {
    return { status: "error", code: "invalid_conversation" };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.chatStart,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { data, error } = await supabase.rpc("start_conversation", {
    p_other: otherId,
  });

  if (error || !data) {
    const text = (error?.message ?? "").toLowerCase();

    if (text.includes("not_authorised")) {
      return { status: "error", code: "not_authorised" };
    }
    if (text.includes("invalid_conversation")) {
      return { status: "error", code: "invalid_conversation" };
    }
    if (text.includes("too_many_attempts")) {
      return { status: "error", code: "too_many_attempts" };
    }

    return { status: "error", code: "start_failed" };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/chat`);

  return { status: "success", conversationId: data };
}

/**
 * Advances the caller's read cursor. Invoked directly while the thread page
 * renders (server-side function call, not a round trip from the browser) —
 * RLS only lets each member move their own row.
 */
export async function markConversationReadAction(
  conversationId: string,
): Promise<void> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(conversationId)) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", viewer.id);

  if (error) {
    console.error("[chat] mark read failed", error.message);
  }
}
