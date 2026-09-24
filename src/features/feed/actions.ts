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
import type { ActionState } from "@/features/auth/action-state";
import { postSchema, formDataToObject } from "./validation";

/**
 * Publishing a post. Server action on purpose: it is the one place that can
 * rate-limit (`feed:post` in Postgres) before the insert, while the row itself
 * is still checked by RLS and the `posts` constraints.
 */
export async function createPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireApprovedMember();
  const parsed = postSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: parsed.error.issues
        .map((issue) => String(issue.path[0] ?? ""))
        .filter(Boolean),
    };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.postCreate,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { error } = await supabase.from("posts").insert({
    author_id: viewer.id,
    body: parsed.data.body,
  });

  if (error) {
    console.error("[feed] post insert failed", error.message);
    return { status: "error", code: "post_failed" };
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/profile`);

  return { status: "success", code: "post_published" };
}
