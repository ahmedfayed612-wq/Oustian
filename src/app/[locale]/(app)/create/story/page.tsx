import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireApprovedMember } from "@/features/auth/session";
import { StoryComposer } from "@/features/stories/story-composer";

export async function generateMetadata() {
  const t = await getTranslations("Stories");

  return { title: t("title") };
}

/**
 * Story composer (`/create/story`). The route exists because a story is not a
 * post: nothing here touches the feed's tables, and the composer is sized for a
 * single photo rather than a caption-first canvas.
 */
export default async function CreateStoryPage() {
  // Approved membership is the only gate: the composer uploads with the
  // member's own session, and Postgres re-checks everything on publish.
  await requireApprovedMember();
  const t = await getTranslations("Stories");

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("title")} description={t("hint")} />
      <StoryComposer />
    </div>
  );
}
