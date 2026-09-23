import { defineRouting } from "next-intl/routing";

/**
 * Locales shipped in v1. `ar` is RTL, `en` is LTR.
 *
 * - `localeDetection` negotiates the locale from the browser's
 *   `Accept-Language` header on the first visit.
 * - The chosen locale is remembered in a cookie; `profiles.language` (M1) is
 *   the source of truth once a user is signed in.
 * - `localePrefix: "always"` keeps every URL explicit (`/en/...`, `/ar/...`),
 *   which makes sharing links and QA-ing both directions predictable.
 */
export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

/** Fallback when the browser asks for something we don't ship. */
export const defaultLocale: Locale = "en";

export const localeCookieName = "OUSTIANS_LOCALE";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: localeCookieName,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
});

/** Text direction for a locale — drives `<html dir>` and icon mirroring. */
export function getDirection(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
