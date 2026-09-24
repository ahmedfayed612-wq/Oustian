import { CalendarDays, GraduationCap, Mail, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireApprovedMember } from "@/features/auth/session";
import { Link } from "@/i18n/navigation";
import { facultyOptions } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";

export async function generateMetadata() {
  const t = await getTranslations("Profile");

  return { title: t("metaTitle") };
}

/**
 * The member's own profile: an intro card in the LinkedIn idiom plus an honest
 * "nothing to show yet" panel (posts arrive in M3 — better a real empty state
 * than invented counters).
 */
export default async function ProfilePage() {
  const profile = await requireApprovedMember();
  const locale = await getLocale();
  const t = await getTranslations("Profile");

  const supabase = await createClient();
  const avatarUrl = await signedStorageUrl(supabase, profile.avatar_path);

  const faculty = facultyOptions.find(
    (option) => option.value === profile.faculty,
  );
  const facultyLabel = faculty
    ? locale === "ar"
      ? faculty.nameAr
      : faculty.nameEn
    : null;

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <div className="h-28 bg-brand-soft" aria-hidden="true" />

        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <Avatar
              size="xl"
              name={profile.full_name}
              src={avatarUrl}
              className="ring-4 ring-surface"
            />
            <Link
              href="/profile/edit"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("edit")}
            </Link>
          </div>

          <h1 className="mt-3 text-xl font-bold text-text">
            {profile.full_name}
          </h1>
          <p className="text-sm text-muted" dir="ltr">
            @{profile.username}
          </p>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
            {facultyLabel ? (
              <li className="flex items-center gap-1.5">
                <GraduationCap className="size-4" aria-hidden="true" />
                {facultyLabel}
              </li>
            ) : null}
            {profile.graduation_year ? (
              <li className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                {profile.graduation_year}
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              {t("memberSince", {
                year: new Date(profile.created_at).getFullYear(),
              })}
            </li>
          </ul>

          {profile.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-text">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("emptyBio")}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="brand">{t("approvedChip")}</Chip>
            {profile.role === "admin" ? (
              <Chip tone="accent">{t("adminChip")}</Chip>
            ) : null}
            {profile.is_private ? <Chip>{t("privateBadge")}</Chip> : null}
            <Chip>
              {profile.language === "ar" ? t("language.ar") : t("language.en")}
            </Chip>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-pill bg-surface-2 text-muted">
          <Mail className="size-6" aria-hidden="true" />
        </span>
        <p className="text-[0.9375rem] font-semibold text-text">
          {t("postsSoonTitle")}
        </p>
        <p className="max-w-sm text-sm text-muted">{t("postsSoonBody")}</p>
      </Card>
    </div>
  );
}
