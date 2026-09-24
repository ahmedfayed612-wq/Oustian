import { getTranslations } from "next-intl/server";
import { UniversityLogo } from "@/components/brand/UniversityLogo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Right-hand rail (xl and wider). Holds the suggestion list and the campus
 * panels — the same structure Facebook and LinkedIn use to fill the third
 * column without competing with the feed.
 */
export async function RightRail() {
  const t = await getTranslations("Rail");

  return (
    <aside className="sticky top-16 hidden w-72 shrink-0 flex-col gap-3 pb-6 xl:flex">
      <Card className="p-4">
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("suggestionsTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted">{t("suggestionsBody")}</p>

        <ul className="mt-3 flex flex-col gap-3">
          {[0, 1, 2].map((placeholder) => (
            <li key={placeholder} className="flex items-center gap-2.5">
              <Skeleton className="size-10 rounded-pill" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </span>
              <Button size="sm" variant="secondary" disabled>
                {t("connect")}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col items-center gap-3 p-4">
        <UniversityLogo size="sm" />
        <p className="text-center text-xs leading-relaxed text-muted">
          {t("campusBody")}
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("aboutTitle")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {t("aboutBody")}
        </p>
      </Card>
    </aside>
  );
}
