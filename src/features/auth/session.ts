import { cache } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Who is asking. Derived once per request (React `cache`) so a layout and the
 * page below it share one Supabase round-trip instead of two.
 */
export type Profile = Tables<"profiles">;

export type SessionState =
  /** No Supabase project configured — the UI explains how to set it up. */
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "pending"; profile: Profile }
  | { status: "approved"; profile: Profile }
  | { status: "rejected"; profile: Profile }
  | { status: "suspended"; profile: Profile };

export const getSessionState = cache(async (): Promise<SessionState> => {
  if (!isSupabaseConfigured) return { status: "unconfigured" };

  try {
    const supabase = await createClient();
    // getClaims() verifies the access token locally against the project's
    // asymmetric signing keys (JWKS cached process-wide) instead of paying a
    // network round trip to Auth on every render like getUser() did. A token
    // that is about to expire is refreshed first; anything invalid resolves to
    // "anonymous". Authorization itself is still enforced by RLS on every data
    // read and by the profile status below, so a forged cookie gets nothing.
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error || !userId) return { status: "anonymous" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    // A session without a profile means the signup trigger never ran (or the
    // row was deleted): treat it as anonymous rather than guessing.
    if (!profile) return { status: "anonymous" };

    if (profile.status === "approved") return { status: "approved", profile };
    if (profile.status === "pending") return { status: "pending", profile };
    if (profile.status === "rejected") return { status: "rejected", profile };

    return { status: "suspended", profile };
  } catch (error) {
    // Never take the app down because the auth service hiccupped.
    console.error("[session] failed to resolve session", error);
    return { status: "anonymous" };
  }
});

/**
 * The states a signed-in visitor can be in. `requireSession()` returns this, so
 * callers can rely on `state.profile` existing.
 */
export type ActiveSessionState = Extract<
  SessionState,
  { status: "pending" | "approved" | "rejected" | "suspended" }
>;

/**
 * Gate for every screen inside the `(app)` route group. Anonymous visitors go
 * to sign-in, unapproved members to the holding screen.
 */
export async function requireApprovedMember(): Promise<Profile> {
  const state = await getSessionState();
  const locale = await getLocale();

  if (state.status === "approved") return state.profile;

  if (state.status === "anonymous" || state.status === "unconfigured") {
    redirect(`/${locale}/login`);
  }

  redirect(`/${locale}/pending`);
}

/** As above, plus an admin check. Used by the approval screens. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireApprovedMember();

  if (profile.role !== "admin") {
    const locale = await getLocale();
    redirect(`/${locale}/`);
  }

  return profile;
}

/** Signed in but not necessarily approved — the pending screen uses this. */
export async function requireSession(): Promise<ActiveSessionState> {
  const state = await getSessionState();

  if (state.status === "anonymous" || state.status === "unconfigured") {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  return state;
}
