import { z } from "zod";

/**
 * Feed validation. The database check constraints repeat every rule — neither
 * layer is trusted alone (same contract as the auth schemas).
 */

export const postSchema = z.object({
  body: z.string().trim().min(1, "post_required").max(5000, "post_too_long"),
});

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
