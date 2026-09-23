import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This single proxy does two
 * things, in order:
 *
 *  1. negotiates/redirects the locale (`/` -> `/en` or `/ar`),
 *  2. refreshes the Supabase session cookie on the resulting response.
 */
const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  return refreshSupabaseSession(request, response);
}

export const config = {
  // Skip API routes, Next internals and anything that looks like a file
  // (e.g. /icon.svg, /manifest.webmanifest) — those must never be locale
  // prefixed.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
