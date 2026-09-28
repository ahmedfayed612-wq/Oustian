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

/**
 * Publishing a story: a photo is required (a story without one would render an
 * empty frame), the caption is optional. `mediaKey` is the storage path the
 * ticket action minted; its ownership and its real bytes are checked in the
 * action, not here.
 */
export const storySchema = z.object({
  mediaKey: z.string().trim().min(1, "story_photo_required").max(200),
  caption: z
    .string()
    .trim()
    .max(MAX_STORY_CAPTION_LENGTH, "caption_too_long")
    .optional()
    .default(""),
});
