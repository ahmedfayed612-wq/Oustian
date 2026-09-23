import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Light/dark/system theming. `next-themes` sets a `class` on <html>, which the
 * `dark:` variant and the `.dark` token block in globals.css both key off.
 * `system` is the default so the app matches the student's phone out of the box.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
