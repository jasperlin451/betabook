import { headers } from "next/headers";
import { initAuth } from "@/lib/auth";

export async function getSession() {
  const auth = await initAuth();
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session;
}
