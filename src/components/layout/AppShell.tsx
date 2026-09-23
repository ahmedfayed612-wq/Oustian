import { getTranslations } from "next-intl/server";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

/**
 * Application chrome: skip link, sticky top bar, desktop sidebar, mobile bottom
 * bar and the centered content column (mobile first, roughly 360-430px wide).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Common");

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text focus:shadow-lift"
      >
        {t("skipToContent")}
      </a>

      <TopBar />

      <div className="mx-auto flex w-full max-w-5xl">
        <SideNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-12"
        >
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
