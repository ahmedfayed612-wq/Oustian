import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontClassNames } from "@/app/fonts";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getDirection, routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import "@/app/globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      url: "/",
    },
    appleWebApp: {
      capable: true,
      title,
      statusBarStyle: "default",
    },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // full-bleed on notched phones; the bottom nav adds its own safe-area padding
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F3F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1417" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    // `dir` drives every logical-property utility in the app (ms-/me-/ps-/pe-/start-/end-)
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={fontClassNames}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AppShell>{children}</AppShell>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
