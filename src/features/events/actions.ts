"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireApprovedMember } from "@/features/auth/session";
import type { ActionState } from "@/features/auth/action-state";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { eventSchema, formDataToObject } from "./validation";

/** Publishes an event; `datetime-local` values become real instants here. */
export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireApprovedMember();
  const parsed = eventSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: parsed.error.issues
        .map((issue) => String(issue.path[0] ?? ""))
        .filter(Boolean),
    };
  }

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = parsed.data.ends_at ? new Date(parsed.data.ends_at) : null;

  if (
    Number.isNaN(startsAt.getTime()) ||
    (endsAt && Number.isNaN(endsAt.getTime()))
  ) {
    return {
      status: "error",
      code: "invalid_input",
      fields: ["starts_at"],
    };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.eventCreate,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { error } = await supabase.from("events").insert({
    creator_id: viewer.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
  });

  if (error) {
    const text = error.message.toLowerCase();

    if (text.includes("too_many_attempts")) {
      return { status: "error", code: "too_many_attempts" };
    }
    if (text.includes("not_authorised")) {
      return { status: "error", code: "not_authorised" };
    }

    console.error("[events] insert failed", error.message);
    return { status: "error", code: "event_failed" };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/events`);
  redirect(`/${locale}/events`);
}
