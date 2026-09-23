"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Single browser client for the whole tab. Creating more than one leads to
 * duplicated auth listeners and confusing "logged out" flickers.
 */
let browserClient: SupabaseClient<Database> | undefined;

export function createClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { url, anonKey } = requireSupabaseConfig();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
