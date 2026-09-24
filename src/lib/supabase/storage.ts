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
 * Signed URL for a private Storage object. Avatars live in a private bucket, so
 * every render mints a short-lived URL instead of exposing a public path.
 */
export async function signedStorageUrl(
  supabase: SupabaseClient<Database>,
  path: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("[storage] failed to sign", path, error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}
