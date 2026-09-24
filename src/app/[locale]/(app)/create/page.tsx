import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";
import { PostComposer } from "./post-composer";

export async function generateMetadata() {
  const t = await getTranslations("Composer");

  return { title: t("title") };
}

/** Full-screen composer: publish a text post straight to the feed. */
export default async function CreatePage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Composer");

  const supabase = await createClient();
  const avatarUrl = await signedStorageUrl(supabase, viewer.avatar_path);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("title")} description={t("hint")} />
      <PostComposer me={{ fullName: viewer.full_name, avatarUrl }} />
    </div>
  );
}
