// Bilingual on purpose: this screen renders when no locale could be resolved
// (e.g. a request the i18n proxy never matched), so there is no active language.
import Link from "next/link";
import "./globals.css";

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-5xl font-bold text-brand">404</p>
          <h1 className="text-lg font-semibold text-text">Page not found</h1>
          <p className="text-sm text-muted" lang="ar" dir="rtl">
            الصفحة غير موجودة — جرّب ترجع للرئيسية.
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex min-h-11 items-center rounded-control bg-brand px-4 text-[0.9375rem] font-semibold text-on-brand"
          >
            Oustians
          </Link>
        </main>
      </body>
    </html>
  );
}
