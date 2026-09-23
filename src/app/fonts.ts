import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Latin UI font. Variable, so no explicit weights are needed.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/**
 * Arabic UI font. Not a variable font, so weights are listed explicitly.
 */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/**
 * Both variable classes must be applied to the `<html>` element: the font stacks
 * in globals.css reference them from `:root`.
 */
export const fontClassNames = `${jakarta.variable} ${plexArabic.variable}`;
