import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Rate limiting that survives serverless: every counter lives in the Postgres
 * `rate_limits` table and is bumped by the `consume_rate_limit()` function from
 * the M1 migration. Nothing is kept in process memory (Vercel functions share
 * none between requests) and no raw IP or email is stored — keys are hashed.
 */

export type RateLimitRule = {
  /** Logical bucket, e.g. `auth:signup`. */
  bucket: string;
  /** Postgres interval literal, e.g. `"10 minutes"`. */
  window: string;
  /** Allowed hits per window. */
  max: number;
};

export const rateLimitRules = {
  signUp: { bucket: "auth:signup", window: "1 hour", max: 5 },
  signIn: { bucket: "auth:signin", window: "10 minutes", max: 10 },
  inviteCheck: { bucket: "auth:invite-check", window: "10 minutes", max: 30 },
  profileUpdate: { bucket: "profile:update", window: "10 minutes", max: 30 },
  inviteCreate: { bucket: "admin:invite-create", window: "1 hour", max: 60 },
  approval: { bucket: "admin:approval", window: "10 minutes", max: 100 },
  chatStart: { bucket: "chat:start", window: "10 minutes", max: 30 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Hashes an identifier (IP, email, user id) so the table never holds anything
 * personal. `RATE_LIMIT_SALT` is optional but recommended in production.
 */
export function hashRateLimitKey(raw: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? "oustians";

  return createHash("sha256")
    .update(`${salt}:${raw}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * The caller's IP as seen by the platform. Returns an empty string when no
 * header is available (local development), which makes the limiter a no-op
 * rather than lumping every anonymous request into one bucket.
 */
export async function clientIp() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";

  return headerList.get("x-real-ip")?.trim() ?? "";
}

/**
 * Counts one hit against `rule` for `key`. Returns `false` when the caller is
 * over the limit — callers must treat that as "stop and tell the user", never
 * as a hard failure.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient<Database>,
  rule: RateLimitRule,
  key: string,
): Promise<boolean> {
  if (!key) return true;

  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_bucket: rule.bucket,
      p_key: key,
      p_window: rule.window,
      p_max: rule.max,
    });

    if (error) {
      // A broken limiter must not lock people out of their own app.
      console.error("[rate-limit] consume_rate_limit failed", error.message);
      return true;
    }

    return data ?? true;
  } catch (error) {
    console.error("[rate-limit] unexpected failure", error);
    return true;
  }
}
