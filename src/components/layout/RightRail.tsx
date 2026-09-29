import { getTranslations } from "next-intl/server";
import { UniversityLogo } from "@/components/brand/UniversityLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ConnectButton } from "@/features/connections/connect-button";
import { getSuggestedPeople } from "@/features/connections/suggested-members";
import { Link } from "@/i18n/navigation";

/** How many suggestions the rail shows (it has room for a short list). */
const RAIL_SUGGESTION_COUNT = 5;

/**
 * Right-hand rail (xl and wider). Holds the suggestion list and the campus
 * panels — the same structure Facebook and LinkedIn use to fill the third
 * column without competing with the feed.
 *
 * Suggestions are real: approved members the viewer has no connection row
 * with yet, newest first (a fresh face is the one worth introducing). The
 * candidates and their signed avatars come from the request-cached accessor, so
 * the rail costs no extra query on a page that already asked (the home feed
 * interleaves the same people lower down).
 */
export async function RightRail() {
  const t = await getTranslations("Rail");
  const suggestions = (await getSuggestedPeople()).slice(
    0,
    RAIL_SUGGESTION_COUNT,
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
                    name={person.fullName}
                    src={person.avatarUrl}
                  />
                  <span className="min-w-0 flex flex-col">
                    <span className="block truncate text-sm font-semibold text-text">
                      {person.fullName}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {person.headline ?? `@${person.username}`}
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
