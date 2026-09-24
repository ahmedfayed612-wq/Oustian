"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/**
 * Submit button that disables itself and shows a spinner while its form is in
 * flight — one place to get that right instead of every form re-inventing it.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...rest
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      isLoading={pending}
      loadingLabel={pendingLabel}
      {...rest}
    >
      {children}
    </Button>
  );
}
