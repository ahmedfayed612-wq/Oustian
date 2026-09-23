import { z } from "zod";

/**
 * Public environment variables. Validated once at module load so a bad deploy
 * fails loudly instead of rendering a broken UI.
 *
 * Secrets (e.g. SUPABASE_SERVICE_ROLE_KEY) are intentionally NOT read here —
 * they must only ever be touched by server-only code (see `scripts/`).
 */
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  // Supabase renamed the legacy anon key (`eyJ…`) to a publishable key
  // (`sb_publishable_…`). Accept both names so either .env file works.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${details}`);
}

export const env = {
  siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  /** Publishable key (formerly "anon key"). Safe to expose to the browser. */
  supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} as const;

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

/**
 * Use in code paths that genuinely cannot work without a Supabase project
 * (auth, database, storage). Throws a message that points at `.env.example`.
 */
export function requireSupabaseConfig(): { url: string; anonKey: string } {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey };
}
