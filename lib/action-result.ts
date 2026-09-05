/** The result contract for user-invoked server actions.
 *
 * Next.js redacts uncaught server-action errors in production builds (the
 * client only sees a generic digest message), so a thrown Error's message
 * never reaches the deployed UI. Every action a user can trigger returns
 * this structured result instead of throwing; internal helpers
 * (lib/validation.ts, lib/climbs.ts, lib/sends.ts, requireSession) keep
 * throwing, and the action boundary converts via `toActionResult`.
 */
export type ActionResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

/** An intentional, user-facing action failure — validation problems,
 * business rules ("Can't delete a climb with logged sends"), missing rows.
 * Only messages carried by this class (plus the session mapping below) are
 * shown to users; any other throw is treated as an unexpected internal
 * failure and replaced with GENERIC_ERROR_MESSAGE so raw internals (D1/
 * driver errors, bugs) never leak to the client. */
export class ActionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export const SESSION_EXPIRED_MESSAGE = "Your session has expired — sign in again to continue.";

export const NOT_ADMIN_MESSAGE = "Admins only.";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Thrown by `requireSession` when there's no signed-in session. Defined
 * here rather than in lib/session.ts so this module stays dependency-free
 * (lib/session.ts pulls in next/headers and the whole auth stack). */
export class NotSignedInError extends Error {
  public constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

/** Thrown by `requireAdmin` when the signed-in session isn't an admin.
 * Defined alongside NotSignedInError for the same reason. */
export class NotAdminError extends Error {
  public constructor() {
    super("Not an admin");
    this.name = "NotAdminError";
  }
}

/** Runs an action body, converting throws into `{ ok: false }` results.
 * Only ActionError messages pass through to the user (a missing session
 * gets the friendlier SESSION_EXPIRED_MESSAGE); anything else is logged
 * (so it lands in wrangler's logs) and comes back generic. Nothing in an
 * action body should throw Next.js control-flow errors (redirect/notFound)
 * — navigation happens on the client after the result comes back. */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false, error: SESSION_EXPIRED_MESSAGE };
    }
    if (err instanceof NotAdminError) {
      return { ok: false, error: NOT_ADMIN_MESSAGE };
    }
    if (err instanceof ActionError) {
      return { ok: false, error: err.message };
    }
    console.error(err);
    return { ok: false, error: GENERIC_ERROR_MESSAGE };
  }
}
