import { headers } from "next/headers";

import { NotSignedInError } from "@/lib/action-result";
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
