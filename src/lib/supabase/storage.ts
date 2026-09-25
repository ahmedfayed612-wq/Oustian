import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const AVATAR_BUCKET = "avatars";

/** Uploads are browser → Storage directly, so only these types are allowed. */
export const avatarExtensions = ["jpg", "jpeg", "png", "webp"] as const;

export type AvatarExtension = (typeof avatarExtensions)[number];

export function isAvatarExtension(value: string): value is AvatarExtension {
  return (avatarExtensions as readonly string[]).includes(value);
}

export function avatarObjectPath(userId: string, extension: AvatarExtension) {
  // A new path per upload: objects are immutable, which keeps CDN caching honest.
  return `${userId}/avatar-${Date.now()}.${extension}`;
}

/**
 * Signed URLs for a path stay valid until they expire, and object paths are
 * immutable (a new upload creates a new path — see `avatarObjectPath`), so a
 * URL can be reused for its whole lifetime. Caching them per path removes the
 * Storage round trip that every page render used to pay just to show avatars
 * — it was the most repeated Supabase call in the app (layout, page and feed
 * composer all sign the same avatar on every navigation). Warm server
 * instances reuse the URL; cold ones re-sign as before. Entries are dropped a
 * few minutes before the URL actually expires.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_CACHE_MAX_ENTRIES = 500;
const SIGNED_URL_SAFETY_MS = 5 * 60 * 1000;

function cachedSignedUrl(path: string): string | null {
  const entry = signedUrlCache.get(path);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    signedUrlCache.delete(path);
    return null;
  }

  return entry.url;
}

function rememberSignedUrl(
  path: string,
  url: string,
  expiresInSeconds: number,
): void {
  if (signedUrlCache.size >= SIGNED_URL_CACHE_MAX_ENTRIES) {
    // `Map` keeps insertion order, so the oldest entry goes first.
    const oldest = signedUrlCache.keys().next();
    if (!oldest.done) signedUrlCache.delete(oldest.value);
  }

  signedUrlCache.set(path, {
    url,
    expiresAt: Date.now() + expiresInSeconds * 1000 - SIGNED_URL_SAFETY_MS,
  });
}

/**
 * Signed URL for a private Storage object. Avatars live in a private bucket, so
 * every render mints a short-lived URL instead of exposing a public path.
 */
export async function signedStorageUrl(
  supabase: SupabaseClient<Database>,
  path: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!path) return null;

  const cached = cachedSignedUrl(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("[storage] failed to sign", path, error.message);
    return null;
  }

  const signedUrl = data?.signedUrl ?? null;
  if (signedUrl) rememberSignedUrl(path, signedUrl, expiresInSeconds);

  return signedUrl;
}

/**
 * Batched variant for lists (chat inbox, feed authors): one Storage call for
 * every path instead of one request each. Returns a `{ path: signedUrl }` map
 * so callers can look up what they need and skip the rest. Paths already in
 * the local cache are skipped, so warm instances spend no network call at all.
 */
export async function signedStorageUrls(
  supabase: SupabaseClient<Database>,
  paths: readonly (string | null | undefined)[],
  expiresInSeconds = 60 * 60,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];

  if (unique.length === 0) return {};

  const urls: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of unique) {
    const cached = cachedSignedUrl(path);
    if (cached) urls[path] = cached;
    else missing.push(path);
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrls(missing, expiresInSeconds);

    if (error || !data) {
      console.error("[storage] failed to sign batch", error?.message);
      return urls;
    }

    for (const item of data) {
      if (item.signedUrl && item.path && !item.error) {
        urls[item.path] = item.signedUrl;
        rememberSignedUrl(item.path, item.signedUrl, expiresInSeconds);
      }
    }
  }

  return urls;
}
