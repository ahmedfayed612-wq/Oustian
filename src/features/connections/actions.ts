"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireApprovedMember } from "@/features/auth/session";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern, type ConnectionState } from "./queries";

export type ConnectionAction =
  | "request"
  | "accept"
  | "decline"
  | "cancel"
  | "disconnect";

export type ConnectionActionResult =
  | { status: "success"; state: ConnectionState }
  | {
      status: "error";
      /** Rendered from `Connect.errors.<code>`. */
      code:
        | "not_authorised"
        | "invalid_profile"
        | "invalid_action"
        | "too_many_attempts"
        | "failed";
    };

const ACTIONS = new Set<ConnectionAction>([
  "request",
  "accept",
  "decline",
  "cancel",
  "disconnect",
]);

/**
 * Runs one transition of the connection state machine. The real logic lives
 * in the `set_connection()` Postgres function (race-safe, idempotent — asking
 * twice lands in the same state), so this action only validates the input,
 * rate-limits and maps errors to i18n codes. The resulting state is returned
 * so the button can paint optimistically.
 */
export async function connectionAction(
  otherId: string,
  action: ConnectionAction,
): Promise<ConnectionActionResult> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(otherId) || otherId === viewer.id) {
    return { status: "error", code: "invalid_profile" };
  }

  if (!ACTIONS.has(action)) {
    return { status: "error", code: "invalid_action" };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.connection,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { data, error } = await supabase.rpc("set_connection", {
    p_other: otherId,
    p_action: action,
  });

  if (error || !data) {
    const text = (error?.message ?? "").toLowerCase();

    if (text.includes("not_authorised")) {
      return { status: "error", code: "not_authorised" };
    }
    if (text.includes("invalid_profile")) {
      return { status: "error", code: "invalid_profile" };
    }
    if (text.includes("invalid_action")) {
      return { status: "error", code: "invalid_action" };
    }

    console.error("[connections] set_connection failed", error?.message);
    return { status: "error", code: "failed" };
  }

  // The count chip, the suggestions rail and the requests list all read from
  // the two screens members actually visit after tapping the button.
  const locale = await getLocale();
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/profile`);

  return { status: "success", state: data as ConnectionState };
}
