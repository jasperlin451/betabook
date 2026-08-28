/** The result contract for user-invoked server actions.
 *
 * Next.js redacts uncaught server-action errors in production builds (the
 * client only sees a generic digest message), so a thrown Error's message
 * never reaches the deployed UI. Every action a user can trigger returns
 * this structured result instead of throwing; internal helpers
 * (lib/validation.ts, lib/climbs.ts, lib/sends.ts, requireSession) keep
 * throwing, and the action boundary converts via `toActionResult`.
 */
export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired — sign in again to continue.";

/** Thrown by `requireSession` when there's no signed-in session. Defined
 * here rather than in lib/session.ts so this module stays dependency-free
 * (lib/session.ts pulls in next/headers and the whole auth stack). */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

/** Runs an action body, converting throws into `{ ok: false }` results.
 * Error messages thrown by the body are user-facing by convention in this
 * codebase; a missing session gets the friendlier SESSION_EXPIRED_MESSAGE.
 * Nothing in an action body should throw Next.js control-flow errors
 * (redirect/notFound) — navigation happens on the client after the result
 * comes back. */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false, error: SESSION_EXPIRED_MESSAGE };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}
