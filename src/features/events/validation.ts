import { z } from "zod";

/**
 * Event creation. Times arrive as `datetime-local` strings and are converted
 * to instants in the action; the end must simply be after the start (the DB
 * repeats the same rule in `events_window`).
 */
export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "title").max(120, "title"),
    description: z.string().trim().max(2000, "description").optional(),
    location: z.string().trim().max(160, "location").optional(),
    starts_at: z.string().min(1, "starts_at"),
    ends_at: z.string().optional(),
  })
  .refine((value) => !value.ends_at || value.ends_at > value.starts_at, {
    message: "ends_at",
    path: ["ends_at"],
  });

export type EventInput = z.infer<typeof eventSchema>;

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
