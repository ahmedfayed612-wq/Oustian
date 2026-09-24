import { getTranslations } from "next-intl/server";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { FeedPlaceholder } from "@/components/feed/FeedPlaceholder";

/**
 * The home feed. M3 replaces the placeholder posts with real ones; the column,
 * the composer and the card rhythm are already final so nothing shifts later.
 */
export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <FeedComposer />
      <FeedPlaceholder />
    </>
  );
}
