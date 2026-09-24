/**
 * Error codes crossing the server-action boundary.
 *
 * Actions return a code (never a sentence) and the form renders
 * `Auth.errors.<code>` from `src/messages/{en,ar}.json`, so every message stays
 * translatable and the action layer holds no copy.
 */

export const authErrorCodes = [
  "invalid_input",
  "too_many_attempts",
  "invalid_credentials",
  "email_in_use",
  "invite_code_invalid",
  "invite_code_expired",
  "invite_code_exhausted",
  "invite_code_duplicate",
  "invite_code_required",
  "username_taken",
  "username_invalid",
  "email_not_confirmed",
  "signups_disabled",
  "not_authorised",
  "profile_update_failed",
  "avatar_upload_failed",
  "invite_create_failed",
  "approval_failed",
  "unknown",
] as const;

export type AuthErrorCode = (typeof authErrorCodes)[number];

/** Success codes, rendered from `Auth.success.<code>`. */
export const authSuccessCodes = [
  "confirm_email",
  "profile_saved",
  "member_approved",
  "member_rejected",
  "member_suspended",
  "invite_created",
] as const;

export type AuthSuccessCode = (typeof authSuccessCodes)[number];

/** Keys the signup form validates client-side before hitting the server. */
export const fieldErrorCodes = {
  username: ["username", "username_invalid"] as const,
  invite_code: ["invite_code", "invite_code_required"] as const,
  email: ["email"] as const,
  password: ["password_length", "password_required"] as const,
  full_name: ["full_name"] as const,
  bio: ["bio"] as const,
};

export type FieldName = keyof typeof fieldErrorCodes;

/**
 * Maps whatever Supabase (or the signup trigger) says onto one of our codes.
 * The trigger raises SQL exceptions whose names are matched here verbatim, e.g.
 * `invite_code_exhausted`.
 */
export function toAuthErrorCode(message: string | undefined): AuthErrorCode {
  const text = (message ?? "").toLowerCase();

  if (!text) return "unknown";

  for (const code of authErrorCodes) {
    if (text.includes(code)) return code;
  }

  if (text.includes("invalid login credentials")) return "invalid_credentials";
  if (text.includes("email not confirmed")) return "email_not_confirmed";
  if (text.includes("already registered") || text.includes("already exists"))
    return "email_in_use";
  if (
    text.includes("signups not allowed") ||
    text.includes("signup is disabled")
  )
    return "signups_disabled";

  return "unknown";
}
