import type { ActionState } from "./action-state";

/**
 * Turns the codes returned by the auth actions into translated copy. Keys live
 * in `src/messages/*.json` under `Auth.errors.*`, `Auth.success.*` and
 * `Auth.fields.*`, so a new code only ever needs a translation, never a code
 * change in a form.
 */
export type Translator = {
  (key: string): string;
  has: (key: string) => boolean;
};

export type FormMessageState = {
  tone: "error" | "success";
  text: string;
};

export function actionMessage(
  t: Translator,
  state: ActionState,
): FormMessageState | null {
  if (state.status === "idle" || !state.code) return null;

  if (state.status === "error") {
    const key = `errors.${state.code}`;

    return {
      tone: "error",
      text: t.has(key) ? t(key) : t("errors.unknown"),
    };
  }

  const key = `success.${state.code}`;

  return t.has(key) ? { tone: "success", text: t(key) } : null;
}

/** Inline message for one input, driven by the same codes. */
export function fieldMessage(
  t: Translator,
  state: ActionState,
  name: string,
): string | undefined {
  if (state.status !== "error" || !state.fields?.includes(name))
    return undefined;

  const key = `fields.${name}`;

  return t.has(key) ? t(key) : t("errors.invalid_input");
}
