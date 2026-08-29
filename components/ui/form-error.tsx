import type { ReactNode } from "react";
import clsx from "clsx";

type FormErrorProps = {
  /** Set when a specific field points here via `aria-describedby` — pair it
   * with `isInvalid`/`aria-invalid` on that field. */
  id?: string;
  children?: ReactNode;
  className?: string;
};

/** The one way an error message is rendered in a form: the usual small danger
 * text, but as a `role="alert"` live region so screen readers announce it the
 * moment it appears — a bare `<p>` is invisible to them until stumbled over.
 * Renders nothing when there's no message, so it can be written inline as
 * `<FormError>{error}</FormError>`. */
export function FormError({ id, children, className }: FormErrorProps) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={clsx("text-sm text-danger", className)}>
      {children}
    </p>
  );
}
