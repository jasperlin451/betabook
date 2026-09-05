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

/** `session.user.role` is our own column, surfaced via
 * user.additionalFields (lib/auth.ts) — a plain string with no enum in the
 * schema, so "admin" is the one value this app ever grants (see
 * scripts/promote-admin.ts) and checks for. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new NotAdminError();
  return session;
}
