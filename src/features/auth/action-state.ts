import type { AuthErrorCode } from "./errors";

/**
 * State shared by every auth form.
 *
 * This lives outside the `"use server"` module on purpose: a server-action file
 * may only export async functions, so the type and its initial value live here
 * and the actions import them.
 */
export type ActionState = {
  status: "idle" | "error" | "success";
  code?: AuthErrorCode | string;
  /** Field names that failed, for `aria-invalid` and inline messages. */
  fields?: string[];
};

export const initialActionState: ActionState = { status: "idle" };
