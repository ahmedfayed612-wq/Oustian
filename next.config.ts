import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Profile photos (and later post media) are served from Supabase Storage, so
 * `next/image` needs that host on its allow-list. The host is derived from
 * `NEXT_PUBLIC_SUPABASE_URL` rather than hard-coded, so preview deployments and
 * a future project ref keep working — and a build with no env at all still
 * succeeds (the list is simply empty).
 */
function supabaseStoragePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) return [];

  try {
    const { protocol, hostname } = new URL(rawUrl);
    if (protocol !== "https:" && protocol !== "http:") return [];

    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        pathname: "/storage/v1/object/**",
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Baseline hardening. A full CSP is added in M8, once every asset origin
 * (Supabase Storage in particular) is known.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseStoragePatterns(),
    // Storage paths are unique per upload, so objects never change under a
    // given URL — a long client cache keeps the feed cheap.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
