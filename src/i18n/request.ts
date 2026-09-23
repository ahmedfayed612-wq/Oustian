import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Loads the message catalog for the negotiated locale. Unknown locales fall
 * back to the default so a bad URL can never render an empty UI.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Campus is in Egypt — keep relative times and dates in local time.
    timeZone: "Africa/Cairo",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
