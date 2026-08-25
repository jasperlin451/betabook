import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/lib/email";
import * as schema from "@/db/schema";

async function authBuilder() {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // `next dev` falls back to a different port whenever 3000 (or the next
    // few) are already taken locally (e.g. by Docker) — trust the common
    // local dev ports so sign-in/sign-up don't 403 on an origin mismatch
    // just because of which port happened to be free.
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) =>
        sendResetPasswordEmail(user.email, url),
    },
    emailVerification: {
      sendVerificationEmail: ({ user, url }) =>
        sendVerificationEmail(user.email, url),
    },
    session: {
      // A month-long sliding window: every time the session is used and
      // updateAge is reached, expiresIn resets from that point. In practice
      // this keeps a session alive indefinitely for any user active at
      // least once a month, without disabling Better Auth's normal refresh
      // mechanism. Sessions only end sooner via explicit sign-out (or
      // revokeSession/revokeOtherSessions).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
  });
}

let authInstance: Awaited<ReturnType<typeof authBuilder>> | null = null;

export async function initAuth() {
  if (!authInstance) authInstance = await authBuilder();
  return authInstance;
}
