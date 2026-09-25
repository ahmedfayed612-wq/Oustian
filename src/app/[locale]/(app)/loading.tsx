import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while any `(app)` route renders on the server. The AppShell (top bar,
 * rails, bottom nav) lives above this boundary, so a click swaps to this
 * skeleton in one frame instead of holding the previous screen — or a blank
 * page — for the full server render. It also gives Next a loading shell to
 * prefetch for dynamic routes, so the feedback after a click is immediate
 * even on a cold server.
 */
export default async function AppLoading() {
  const t = await getTranslations("Common");

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-24 w-full rounded-card-lg" />
      <Skeleton className="h-44 w-full rounded-card-lg" />
      <Skeleton className="h-44 w-full rounded-card-lg" />
      <Skeleton className="h-44 w-full rounded-card-lg" />
    </div>
  );
}