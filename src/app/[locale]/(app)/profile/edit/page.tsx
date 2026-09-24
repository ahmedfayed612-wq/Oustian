import { getTranslations } from "next-intl/server";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";
import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  const t = await getTranslations("Profile");

  return { title: t("editTitle") };
}

export default async function ProfileEditPage() {
  const profile = await requireApprovedMember();
  const t = await getTranslations("Profile");

  const supabase = await createClient();
  const avatarUrl = await signedStorageUrl(supabase, profile.avatar_path);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold text-text">{t("editTitle")}</h1>
      <ProfileForm
        avatarUrl={avatarUrl}
        profile={{
          fullName: profile.full_name,
          bio: profile.bio ?? "",
          faculty: profile.faculty ?? "",
          graduationYear: profile.graduation_year
            ? String(profile.graduation_year)
            : "",
          language: profile.language === "ar" ? "ar" : "en",
          username: profile.username,
          avatarPath: profile.avatar_path,
          isPrivate: profile.is_private,
        }}
      />
    </div>
  );
}
