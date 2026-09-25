import { CalendarDays, GraduationCap, PenLine, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { PostCard } from "@/features/feed/post-card";
import { listAuthorPosts } from "@/features/feed/queries";
import { Link } from "@/i18n/navigation";
import { facultyOptions } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

export async function generateMetadata() {
  const t = await getTranslations("Profile");

  return { title: t("metaTitle") };
}

/**
 * The member's own profile: an intro card in the LinkedIn idiom followed by
 * "Your posts" — the same `PostCard` the feed renders, so likes, comments and
 * deletion behave exactly as they do on the home feed.
 */
export default async function ProfilePage() {
  const profile = await requireApprovedMember();
  const locale = await getLocale();
  const t = await getTranslations("Profile");

  const supabase = await createClient();
  const posts = await listAuthorPosts(supabase, profile.id, profile.id);

  // One batched Storage call signs this member's avatar and every post
  // author's avatar (usually the same path repeated) in a single round trip.
  const avatarUrls = await signedStorageUrls(supabase, [
    profile.avatar_path,
    ...posts.map((item) => item.author.avatarPath),
  ]);
  const avatarUrl = profile.avatar_path
    ? (avatarUrls[profile.avatar_path] ?? null)
    : null;

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

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-text">{t("postsTitle")}</h2>

        {posts.length === 0 ? (
          <EmptyState
            icon={<PenLine className="size-6" aria-hidden="true" />}
            title={t("postsEmptyTitle")}
            description={t("postsEmptyBody")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((item) => (
              <PostCard
                key={item.post.id}
                post={item.post}
                author={{
                  username: item.author.username,
                  fullName: item.author.fullName,
                  avatarUrl: item.author.avatarPath
                    ? (avatarUrls[item.author.avatarPath] ?? null)
                    : null,
                }}
                me={{
                  id: profile.id,
                  fullName: profile.full_name,
                  avatarUrl,
                }}
                initialLiked={item.likedByMe}
                initialLikeCount={item.likeCount}
                initialCommentCount={item.commentCount}
                canDelete={
                  item.post.author_id === profile.id ||
                  profile.role === "admin"
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
