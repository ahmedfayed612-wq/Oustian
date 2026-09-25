import { cache } from "react";
import { CalendarDays, GraduationCap, Lock, PenLine, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { MessageButton } from "@/features/chat/message-button";
import { PostCard } from "@/features/feed/post-card";
import { listAuthorPosts } from "@/features/feed/queries";
import { facultyOptions } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

const usernamePattern = /^[a-z0-9_]{3,24}$/i;

/**
 * Another member's profile. The lookup is cached per request so
 * `generateMetadata` and the page share one query; RLS already limits it to
 * approved members (everyone else reads as "not found").
 */
const getProfileByUsername = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  if (!usernamePattern.test(username)) return {};

  const profile = await getProfileByUsername(username);

  return profile ? { title: profile.full_name } : {};
}

/**
 * The public-facing profile: identity always visible (name, handle, photo —
 * classmates need to recognise who they're talking to), details behind the
 * member's `is_private` switch, and a Message button that drops straight into
 * the 1:1 chat thread.
 */
export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  if (!usernamePattern.test(username)) notFound();

  const viewer = await requireApprovedMember();
  const t = await getTranslations("Profile");
  const locale = await getLocale();

  const profile = await getProfileByUsername(username);

  if (!profile) notFound();

  // Your own handle resolves to the canonical /profile screen.
  if (profile.id === viewer.id) redirect(`/${locale}/profile`);

  const supabase = await createClient();
  const posts = await listAuthorPosts(supabase, profile.id, viewer.id);

  // One batched Storage call signs this member's avatar, the viewer's avatar
  // (the `PostCard` composer) and every post author's avatar together.
  const avatarUrls = await signedStorageUrls(supabase, [
    profile.avatar_path,
    viewer.avatar_path,
    ...posts.map((item) => item.author.avatarPath),
  ]);
  const avatarUrl = profile.avatar_path
    ? (avatarUrls[profile.avatar_path] ?? null)
    : null;
  const viewerAvatarUrl = viewer.avatar_path
    ? (avatarUrls[viewer.avatar_path] ?? null)
    : null;

  const canSeeDetails = !profile.is_private || viewer.role === "admin";

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
            <MessageButton otherId={profile.id} />
          </div>

          <h1 className="mt-3 text-xl font-bold text-text">
            {profile.full_name}
          </h1>
          <p className="text-sm text-muted" dir="ltr">
            @{profile.username}
          </p>

          {canSeeDetails ? (
            <>
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
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Lock className="size-4 shrink-0" aria-hidden="true" />
              {t("privateNotice")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="brand">{t("approvedChip")}</Chip>
            {profile.role === "admin" ? (
              <Chip tone="accent">{t("adminChip")}</Chip>
            ) : null}
            {profile.is_private ? <Chip>{t("privateBadge")}</Chip> : null}
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-text">
          {t("postsOfTitle", { name: profile.full_name })}
        </h2>

        {posts.length === 0 ? (
          <EmptyState
            icon={<PenLine className="size-6" aria-hidden="true" />}
            title={t("postsOfEmptyTitle")}
            description={t("postsOfEmptyBody", { name: profile.full_name })}
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
                  id: viewer.id,
                  fullName: viewer.full_name,
                  avatarUrl: viewerAvatarUrl,
                }}
                initialLiked={item.likedByMe}
                initialLikeCount={item.likeCount}
                initialCommentCount={item.commentCount}
                canDelete={viewer.role === "admin"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
