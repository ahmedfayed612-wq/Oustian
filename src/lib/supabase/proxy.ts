import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, requireSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase auth cookie on the response produced by the i18n
 * proxy, so server components in the same request see a valid session.
 *
 * No-ops when Supabase is not configured yet (M0 works before a project
 * exists) and when the request carries no auth cookie at all — that keeps
 * every anonymous page render on the fast path.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  if (!isSupabaseConfigured) return response;

  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  if (!hasAuthCookie) return response;

  const { url, anonKey } = requireSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // getClaims() verifies the access token locally (asymmetric signing keys,
    // JWKS cached process-wide) and only reaches the network to refresh a
    // session that is about to expire. Unlike getUser() — which round-tripped
    // to Auth on every single request — this is effectively free on the hot
    // path, which matters because each request used to pay a full
    // transatlantic trip before a page could start rendering.
    await supabase.auth.getClaims();
  } catch (error) {
    // Never let an auth outage take the whole site down — the request still
    // renders, just without a session.
    console.error("[proxy] failed to refresh Supabase session", error);
  }

  return response;
}
