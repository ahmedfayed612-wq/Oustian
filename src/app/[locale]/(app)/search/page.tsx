import { Search, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrls } from "@/lib/supabase/storage";

export async function generateMetadata() {
  const t = await getTranslations("Search");

  return { title: t("label") };
}

/**
 * Strips everything that could break out of a PostgREST `.or(...)` expression
 * (`%`, `_` are LIKE wildcards; `,()'"` are filter syntax) and caps the length.
 */
function sanitizeQuery(raw: string) {
  return raw
    .replace(/[%,()'"_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Member search: GET form → `?q=` → approved profiles matching name or handle.
 * Reads are RLS-scoped (approved members only) and results link straight to
 * `/profile/<username>`, where the Message button opens a chat.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Search");
  const { q } = await searchParams;
  const term = sanitizeQuery(typeof q === "string" ? q : "");

  const supabase = await createClient();

  let results:
    | {
        id: string;
        username: string;
        full_name: string;
        avatar_path: string | null;
      }[]
    | null = null;

  if (term.length >= 2) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_path")
      .eq("status", "approved")
      .neq("id", viewer.id)
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
      .order("full_name")
      .limit(21);

    if (error) {
      console.error("[search] profiles query failed", error.message);
    }

    results = data ?? [];
  }

  const avatarUrls = await signedStorageUrls(
    supabase,
    (results ?? []).map((person) => person.avatar_path),
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("label")} description={t("description")} />

      <Card className="p-4">
        <form method="get" action="">
          <label htmlFor="oustians-search" className="sr-only">
            {t("label")}
          </label>
          <div className="flex items-center gap-2 rounded-pill bg-surface-2 ps-4 pe-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              id="oustians-search"
              type="search"
              name="q"
              defaultValue={term}
              placeholder={t("placeholder")}
              className="min-h-11 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="min-h-10 shrink-0 rounded-pill px-3 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              {t("submit")}
            </button>
          </div>
        </form>
      </Card>

      {results === null ? (
        <EmptyState
          icon={<Search className="size-6" aria-hidden="true" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-6" aria-hidden="true" />}
          title={t("noResultsTitle", { term })}
          description={t("noResultsBody")}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul>
            {results.map((person) => (
              <li
                key={person.id}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={`/profile/${person.username}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <Avatar
                    size="md"
                    name={person.full_name}
                    src={avatarUrls[person.avatar_path ?? ""] ?? null}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold text-text">
                      {person.full_name}
                    </span>
                    <span
                      className="block truncate text-sm text-muted"
                      dir="ltr"
                    >
                      @{person.username}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
