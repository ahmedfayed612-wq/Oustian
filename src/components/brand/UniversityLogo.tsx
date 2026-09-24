import { cn } from "@/lib/utils/cn";
import { PeakMark } from "./BrandMark";

/**
 * The university lockup, laid out like the uploaded OUST logo: peak mark,
 * wordmark, English name and the Arabic name in gold.
 *
 * The strings are brand copy (proper nouns) and are identical in both locales,
 * so they live here rather than in the translation files. The Arabic line keeps
 * its own `dir` so it reads correctly inside an LTR page.
 */
export type UniversityLogoSize = "sm" | "md" | "lg";

const markSizes: Record<UniversityLogoSize, string> = {
  sm: "h-6 w-9",
  md: "h-9 w-[54px]",
  lg: "h-14 w-[84px]",
};

const wordSizes: Record<UniversityLogoSize, string> = {
  sm: "text-lg tracking-[0.28em]",
  md: "text-2xl tracking-[0.32em]",
  lg: "text-4xl tracking-[0.34em]",
};

const subtitleSizes: Record<UniversityLogoSize, string> = {
  sm: "text-[0.5625rem]",
  md: "text-[0.6875rem]",
  lg: "text-sm",
};

const arabicSizes: Record<UniversityLogoSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

/** English + Arabic names exactly as they appear on the university logo. */
export const universityName = {
  wordmark: "OUST",
  line1: "Obour University",
  line2: "For Science and Technology",
  arabic: "جامعة العبور للعلوم والتكنولوجيا",
} as const;

export function UniversityLogo({
  size = "md",
  className,
}: {
  size?: UniversityLogoSize;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <PeakMark className={markSizes[size]} />

      <span
        className={cn(
          "mt-2 font-extrabold text-brand uppercase",
          wordSizes[size],
        )}
      >
        {universityName.wordmark}
      </span>
      <span
        className={cn(
          "mt-1 font-semibold tracking-[0.2em] text-brand/80 uppercase",
          subtitleSizes[size],
        )}
      >
        {universityName.line1}
      </span>
      <span
        className={cn(
          "font-medium tracking-[0.16em] text-muted uppercase",
          subtitleSizes[size],
        )}
      >
        {universityName.line2}
      </span>
      <span
        lang="ar"
        dir="rtl"
        className={cn("mt-1.5 font-arabic text-accent-ink", arabicSizes[size])}
      >
        {universityName.arabic}
      </span>
    </div>
  );
}
