import { headers } from "next/headers";

import { NotAdminError, NotSignedInError } from "@/lib/action-result";
import { initAuth } from "@/lib/auth";

export async function getSession() {
  const auth = await initAuth();
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new NotSignedInError();
  return session;
}

type SessionResult = Awaited<ReturnType<typeof requireSession>>;

/** `session.user.role` is our own column, surfaced via
 * user.additionalFields (lib/auth.ts) — a plain string with no enum in the
 * schema, so "admin" is the one value this app ever grants (see
 * scripts/promote-admin.ts) and checks for. Exported so gated actions can
 * branch on it directly (`isAdmin(session) ? apply : queue`) without needing
 * a second session read through requireAdmin. Takes just the `role` field it
 * needs rather than the full session shape, so callers (and tests) don't
 * have to construct one. */
export function isAdmin(session: { user: { role?: string | null } }): boolean {
  return session.user.role === "admin";
}

export async function requireAdmin(): Promise<SessionResult> {
  const session = await requireSession();
  if (!isAdmin(session)) throw new NotAdminError();
  return session;
}
