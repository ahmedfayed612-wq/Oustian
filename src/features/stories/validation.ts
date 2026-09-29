import { z } from "zod";
import { MAX_STORY_CAPTION_LENGTH } from "@/features/media/limits";

/**
 * Story validation. The database check constraints repeat every rule
 * (`create_story` plus the `story_media` checks) — neither layer is trusted
 * alone, the same contract as the feed and auth schemas.
 */

/** Canonical UUID test shared by the story actions (ids come from the client). */
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Display bounds for the composer's video metadata probe (≤ 20000 px). */
export const MAX_MEDIA_DIMENSION = 20_000;

/**
 * Publishing a story: media is required (a story without any would render an
 * empty frame), the caption is optional. `mediaKey` is the storage path the
 * ticket action minted; its ownership and its real bytes are checked in the
 * action, not here.
 *
 * `mediaWidth` / `mediaHeight` are only meaningful for a clip: the browser
 * measures the <video> (rotation applied) and the action refines the pair
 * against the minimum-size rule. For a photo the server reads the dimensions
 * from the bytes and ignores these, so they stay optional and bounded.
 */
export const storySchema = z.object({
  mediaKey: z.string().trim().min(1, "story_media_required").max(200),
  caption: z
    .string()
    .trim()
    .max(MAX_STORY_CAPTION_LENGTH, "caption_too_long")
    .optional()
    .default(""),
  mediaWidth: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_MEDIA_DIMENSION)
    .optional(),
  mediaHeight: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_MEDIA_DIMENSION)
    .optional(),
});

/** The pair the video validator needs, or null when the probe was incomplete. */
export function probeDimensions(parsed: {
  mediaWidth?: number;
  mediaHeight?: number;
}): { width: number; height: number } | null {
  if (!parsed.mediaWidth || !parsed.mediaHeight) return null;

  return { width: parsed.mediaWidth, height: parsed.mediaHeight };
}

