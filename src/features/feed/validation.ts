import { z } from "zod";
import { MAX_ALT_TEXT_LENGTH } from "@/features/media/limits";

/**
 * Feed validation. The database check constraints repeat every rule — neither
 * layer is trusted alone (same contract as the auth schemas).
 */

/**
 * Post creation schema. A post must have either text, a photo, or both.
 * Empty text with no photo is rejected as "post_required".
 */
export const postSchema = z
  .object({
    body: z.string().trim().max(5000, "post_too_long").optional().default(""),
    mediaKey: z.string().trim().min(1).optional(),
    altText: z
      .string()
      .trim()
      .max(MAX_ALT_TEXT_LENGTH, "alt_too_long")
      .optional()
      .default(""),
  })
  .refine(
    (data) => (data.body && data.body.length > 0) || Boolean(data.mediaKey),
    {
      message: "post_required",
      path: ["body"],
    },
  );

export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "comment_required")
    .max(1000, "comment_too_long"),
});

/** Reads a form into a plain object, dropping empty optional fields. */
export function formDataToObject(formData: FormData) {
  const entries: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed === "") continue;

    entries[key] = trimmed;
  }

  return entries;
}

