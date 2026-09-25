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
  /**
   * Echo of what was submitted (never passwords). React resets every input once
   * a form action finishes — error or not — and `defaultValue` is what that
   * reset restores, so handing the values back is what stops a rejected submit
   * emptying the form.
   */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { status: "idle" };
