"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/IconButton";
import { useHydrated } from "@/lib/hooks/use-hydrated";

const themeOrder = ["system", "light", "dark"] as const;
type ThemeName = (typeof themeOrder)[number];

const themeIcons: Record<ThemeName, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

function isThemeName(value: string | undefined): value is ThemeName {
  return themeOrder.includes(value as ThemeName);
}

/** Cycles system -> light -> dark. The stored theme is browser-only, so the
 *  icon and label wait for hydration to avoid a mismatch. */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const current: ThemeName = hydrated && isThemeName(theme) ? theme : "system";
  const next =
    themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
  const Icon = themeIcons[current];

  return (
    <IconButton
      label={t("switchTo", { theme: t(next) })}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-5" />
    </IconButton>
  );
}
