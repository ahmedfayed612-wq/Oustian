"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  clientIp,
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./action-state";
import { toAuthErrorCode } from "./errors";
import { getSessionState } from "./session";
import {
  formDataToObject,
  inviteCodeSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
} from "./validation";

function invalidFields(error: { issues: { path: PropertyKey[] }[] }) {
  return error.issues
    .map((issue) => String(issue.path[0] ?? ""))
    .filter((name) => name !== "");
}

/**
 * Invite-gated signup. The invite code travels in the auth metadata and is
 * consumed by the `handle_new_user()` trigger inside the same transaction as
 * the auth user — so a bad code creates nothing at all.
 */
export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: invalidFields(parsed.error),
    };
  }

  const supabase = await createClient();
  const locale = await getLocale();
  const ip = await clientIp();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.signUp,
    hashRateLimitKey(`ip:${ip}`),
  );

  if (!withinLimit) {
    return { status: "error", code: "too_many_attempts" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Where Supabase sends people back to (confirmation and recovery links).
      emailRedirectTo: `${env.siteUrl}/${locale}/login`,
      data: {
        invite_code: parsed.data.invite_code,
        username: parsed.data.username,
        full_name: parsed.data.full_name,
        faculty: parsed.data.faculty ?? null,
        graduation_year: parsed.data.graduation_year ?? null,
        language: locale,
      },
    },
  });

  if (error) {
    return { status: "error", code: toAuthErrorCode(error.message) };
  }

  // Confirmation disabled on the project: we already have a session.
  if (data.session) {
    redirect(`/${locale}/pending`);
  }

  // Confirmation enabled: point them at the email instead of bouncing around.
  return { status: "success", code: "confirm_email" };
}

/** Sign in, then send the member where their account status allows. */
export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: invalidFields(parsed.error),
    };
  }

  const supabase = await createClient();
  const ip = await clientIp();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.signIn,
    hashRateLimitKey(`ip:${ip}`),
  );

  if (!withinLimit) {
    return { status: "error", code: "too_many_attempts" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", code: toAuthErrorCode(error.message) };
  }

  const locale = await getLocale();
  const state = await getSessionState();

  redirect(state.status === "approved" ? `/${locale}/` : `/${locale}/pending`);
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const locale = await getLocale();
  redirect(`/${locale}/login`);
}

/**
 * Live check behind the signup form so an invalid or exhausted code is caught
 * before an account is attempted. Read-only: it never consumes the code.
 */
export async function checkInviteCodeAction(
  code: string,
): Promise<{ valid: boolean; code?: string }> {
  const parsed = inviteCodeSchema.safeParse(code);

  if (!parsed.success) return { valid: false, code: "invite_code_required" };
  if (!isSupabaseConfigured) return { valid: false, code: "unknown" };

  const supabase = await createClient();
  const ip = await clientIp();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.inviteCheck,
    hashRateLimitKey(`ip:${ip}`),
  );

  if (!withinLimit) return { valid: false, code: "too_many_attempts" };

  const { data, error } = await supabase.rpc("is_invite_code_valid", {
    p_code: parsed.data,
  });

  if (error) return { valid: false, code: "unknown" };

  return { valid: Boolean(data) };
}

/**
 * Profile edit. `full_name`, bio, faculty, year and language only — username,
 * status and role are protected by a database trigger rather than by hiding
 * fields, so a crafted request cannot self-approve either.
 */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await getSessionState();

  if (state.status !== "approved") {
    return { status: "error", code: "not_authorised" };
  }

  const parsed = profileSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: invalidFields(parsed.error),
    };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.profileUpdate,
    hashRateLimitKey(`user:${state.profile.id}`),
  );

  if (!withinLimit) {
    return { status: "error", code: "too_many_attempts" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      bio: parsed.data.bio ?? null,
      faculty: parsed.data.faculty ?? null,
      graduation_year: parsed.data.graduation_year ?? null,
      language: parsed.data.language,
      is_private: parsed.data.is_private === "on",
    })
    .eq("id", state.profile.id);

  if (error) {
    return { status: "error", code: "profile_update_failed" };
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}/profile`);
  redirect(`/${locale}/profile`);
}
