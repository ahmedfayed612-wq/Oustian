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
import { MAX_VOICE_DURATION_MS, MAX_VOICE_BYTES, isVoiceMime } from "./voice-constants";
import type { Json } from "@/lib/supabase/database.types";

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

/**
 * Sends a voice message. The browser has already uploaded the audio bytes
 * straight to the private `voice` Storage bucket (browser -> Storage, matching
 * the avatar pattern), so this action only writes the metadata row: it
 * validates the caller's membership and the shape of the reference, then lets
 * the `messages` RLS insert policy re-check membership a second time. The
 * `handle_chat_message_notify` trigger and the `messages` realtime publication
 * deliver it to the recipient without a refresh — same pipeline as text.
 */
export async function sendVoiceMessageAction(
  conversationId: string,
  audioPath: string,
  durationMs: number,
  mimeType: string,
  fileSizeBytes: number,
  waveformData: number[],
): Promise<ChatActionResult> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(conversationId)) {
    return { status: "error", code: "invalid_conversation" };
  }

  // Server-side validation — the browser is not trusted. The reference must
  // look like a `voice` bucket key owned by the sender, inside their own
  // `<user_id>/<uuid>.<ext>` folder (mirrors the avatar upload contract).
  const pathOk = new RegExp(
    `^voice/${viewer.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webm|m4a|mp3|wav|ogg)$`,
  ).test(audioPath);
  if (!pathOk) {
    return { status: "error", code: "send_failed" };
  }

  // Size ceilings and the codec allow-list, as a backstop on top of the
  // Storage bucket's own limits — the uploaded bytes, not this row, carry the
  // weight, but a forged client must not be able to stuff the table.
  const sizeOk =
    Number.isFinite(fileSizeBytes) &&
    fileSizeBytes > 0 &&
    fileSizeBytes <= MAX_VOICE_BYTES;
  if (!sizeOk) {
    return { status: "error", code: "send_failed" };
  }
  if (!isVoiceMime(mimeType)) {
    return { status: "error", code: "send_failed" };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.voiceSend,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  // Duration: ms integers only; reject fractional or script-generated values.
  const duration = Math.round(durationMs);
  const durationOk =
    Number.isFinite(duration) && duration > 0 && duration <= MAX_VOICE_DURATION_MS;
  if (!durationOk) {
    return { status: "error", code: "send_failed" };
  }

  // Waveform: bounded numeric samples the player can always render. This is a
  // `jsonb` column and an attacker-controlled array would be cheap to inflate,
  // so clamp shape and ranges here — never trust the composer.
  if (
    !Array.isArray(waveformData) ||
    waveformData.length > 512 ||
    !waveformData.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
    )
  ) {
    return { status: "error", code: "send_failed" };
  }

  const insert: {
    conversation_id: string;
    sender_id: string;
    body: string;
    type: string;
    audio_path: string;
    duration_ms: number;
    mime_type: string;
    file_size_bytes: number;
    waveform_data: Json;
  } = {
    conversation_id: conversationId,
    sender_id: viewer.id,
    body: "",
    type: "voice",
    audio_path: audioPath,
    duration_ms: duration,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
    waveform_data: waveformData as unknown as Json,
  };

  const { error } = await supabase.from("messages").insert(insert);

  if (error) {
    console.error("[chat] sendVoiceMessage failed", error.message);
    return { status: "error", code: "send_failed" };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/chat/${conversationId}`);

  return { status: "success", conversationId };
}
