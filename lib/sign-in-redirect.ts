/**
 * Helpers for the `?next=` continuation param on /sign-in and /sign-up.
 *
 * Auth gates (middleware and page-level session checks) send signed-out
 * users to `/sign-in?next=<destination>`; on a successful sign-in the form
 * returns them to that destination instead of unconditionally to /account.
 * Sign-up carries the same param through its "sign in" links and the
 * post-verification callback so the continuation survives the whole
 * sign-up → verify → sign-in flow.
 */

/** Where a successful sign-in lands when no (valid) `next` param exists. */
export const DEFAULT_SIGNED_IN_PATH = "/account";

/**
 * Validates a `?next=` continuation target, returning it only if it is a
 * same-origin relative path. Everything else — absolute URLs
 * (`https://evil.com`, which lacks the leading "/"), protocol-relative URLs
 * (`//evil.com`), backslash variants (`/\evil.com`, which browsers treat as
 * `//evil.com`), and values with control characters (tab/newline are
 * stripped by URL parsers, so `/\t/evil.com` would resolve to
 * `//evil.com`) — is rejected so the param can't become an open redirect.
 */
export function safeNextPath(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (/[\x00-\x1f]/.test(value)) return undefined;
  return value;
}

/** The sign-in URL that continues to `next` after a successful sign-in. */
export function signInUrl(next?: string): string {
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}

/** The sign-up URL that carries the continuation through to sign-in. */
export function signUpUrl(next?: string): string {
  return next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up";
}
