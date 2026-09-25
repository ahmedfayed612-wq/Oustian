import { getTranslations } from "next-intl/server";
import { UniversityLogo } from "@/components/brand/UniversityLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { requireApprovedMember } from "@/features/auth/session";
import { ConnectButton } from "@/features/connections/connect-button";
import { listSuggestedMembers } from "@/features/connections/queries";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

/**
 * Right-hand rail (xl and wider). Holds the suggestion list and the campus
 * panels — the same structure Facebook and LinkedIn use to fill the third
 * column without competing with the feed.
 *
 * Suggestions are real: approved members the viewer has no connection row
 * with yet, newest first (a fresh face is the one worth introducing). The
 * viewer's session resolves through the per-request cache, so the rail adds
 * no extra auth round trip to the page it sits on.
 */
export async function RightRail() {
  const t = await getTranslations("Rail");
  const viewer = await requireApprovedMember();

  const supabase = await createClient();
  const suggestions = await listSuggestedMembers(supabase, viewer.id, 5);

  const avatarUrls = await signedStorageUrls(
    supabase,
    suggestions.map((person) => person.avatar_path),
  );

  return (
    <aside className="sticky top-16 hidden w-72 shrink-0 flex-col gap-3 pb-6 xl:flex">
      <Card className="p-4">
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("suggestionsTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted">{t("suggestionsBody")}</p>

        {suggestions.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t("suggestionsEmpty")}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {suggestions.map((person) => (
              <li key={person.id} className="flex items-center gap-2.5">
                <Link
                  href={`/profile/${person.username}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Avatar
                    size="sm"
                    name={person.full_name}
                    src={
                      person.avatar_path
                        ? (avatarUrls[person.avatar_path] ?? null)
                        : null
                    }
                  />
                  <span className="min-w-0 flex flex-col">
                    <span className="block truncate text-sm font-semibold text-text">
                      {person.full_name}
                    </span>
                    <span
                      className="block truncate text-xs text-muted"
                      dir="ltr"
                    >
                      @{person.username}
                    </span>
                  </span>
                </Link>
                <ConnectButton
                  otherId={person.id}
                  initial="none"
                  compact
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
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
