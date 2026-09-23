import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Sessions are refreshed by the proxy on every request, so this client only
 * reads/writes cookies opportunistically. `createServerClient` must be called
 * per request — never cache it in a module-level variable.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy already refreshed the session for this
          // request, and it will persist the new cookies on the response.
        }
      },
    },
  });
}
