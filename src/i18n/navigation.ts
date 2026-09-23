import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for Next.js' navigation APIs. Always import `Link`,
 * `useRouter`, `usePathname` and `redirect` from here (not from `next/link` /
 * `next/navigation`) so the active locale prefix is preserved.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
