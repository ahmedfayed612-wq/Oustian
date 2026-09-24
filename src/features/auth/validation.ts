import { z } from "zod";

/**
 * Validation shared by the auth server actions. Everything the user types is
 * validated here first; the database constraints are the second line of defence
 * (see the M1 migration) and are never trusted to be the only one.
 */

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "username");

/** Invite codes are stored uppercase: `OUST-FOUNDERS-2026`. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{3,31}$/, "invite_code");

export const emailSchema = z.string().trim().toLowerCase().email("email");

export const passwordSchema = z
  .string()
  .min(8, "password_length")
  .max(72, "password_length");

export const signUpSchema = z.object({
  invite_code: inviteCodeSchema,
  full_name: z.string().trim().min(2, "full_name").max(80, "full_name"),
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  faculty: z.string().trim().max(80).optional(),
  graduation_year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password_required").max(72),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "full_name").max(80, "full_name"),
  bio: z.string().trim().max(280, "bio").optional(),
  faculty: z.string().trim().max(80).optional(),
  graduation_year: z.coerce.number().int().min(2000).max(2100).optional(),
  language: z.enum(["en", "ar"]),
  // Checkboxes send nothing when unticked, `"on"` when ticked (formDataToObject
  // already dropped empty strings, so presence === true).
  is_private: z.enum(["on"]).optional(),
});

export const inviteCodeCreateSchema = z.object({
  code: inviteCodeSchema,
  label: z.string().trim().max(80).optional(),
  max_uses: z.coerce.number().int().min(1).max(500),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type InviteCodeCreateInput = z.infer<typeof inviteCodeCreateSchema>;

/** Turns `""` into `undefined` so optional fields behave in HTML forms. */
export function emptyToUndefined(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text === "" ? undefined : text;
}

/**
 * Reads a form into a plain object, dropping empty optional fields. Zod then
 * sees `undefined` instead of `""`, which keeps `.optional()` honest.
 */
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
