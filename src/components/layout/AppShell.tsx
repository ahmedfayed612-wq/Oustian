import { getTranslations } from "next-intl/server";
import { BottomNav } from "./BottomNav";
import { RightRail } from "./RightRail";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import type { ChromeMember } from "./member";

/**
 * Application chrome — the three-column social layout (Facebook / LinkedIn):
 *
 *   ┌─────────────── top bar: search · section tabs · actions ───────────────┐
 *   │  left rail  │      feed column (max 37.5rem)      │   right rail       │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * The left rail appears from `lg` and the right rail from `xl`, so tablet and
 * phone fall back to a single comfortable column with the bottom bar for
 * navigation — exactly how the big social apps collapse.
 *
 * The member is resolved by the `(app)` layout before this renders, so the
 * chrome never triggers its own auth round-trip.
 */
export async function AppShell({
  member,
  children,
}: {
  member: ChromeMember;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Common");

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text focus:shadow-lift"
      >
        {t("skipToContent")}
      </a>

      <TopBar member={member} />

      <div className="mx-auto flex w-full max-w-[78rem] items-start gap-6 px-3 pt-3 lg:pt-5">
        <SideNav member={member} />

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-24 lg:pb-10"
        >
          <div className="mx-auto flex w-full max-w-[37.5rem] flex-col gap-3 lg:mx-0">
            {children}
          </div>
        </main>

        <RightRail />
      </div>

      <BottomNav />
    </div>
  );
}
