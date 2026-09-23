import { notFound } from "next/navigation";

/**
 * Any unknown path inside a locale (e.g. /en/nope) renders the localized
 * not-found page instead of falling through to a bare Next.js 404.
 */
export default function CatchAllNotFoundPage() {
  notFound();
}
