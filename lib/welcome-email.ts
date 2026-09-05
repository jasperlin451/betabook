import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema";
import { sendWelcomeEmail } from "@/lib/email";

export async function sendWelcomeEmailOnce(
  db: Database,
  account: { id: string; email: string; name: string },
) {
  // Claim first, send second, and let the database decide who won. Two
  // concurrent verify-email requests both reach this line; the IS NULL
  // predicate means exactly one of them gets a row back.
  const claimed = await db
    .update(user)
    .set({ welcomeEmailSentAt: new Date() })
    .where(and(eq(user.id, account.id), isNull(user.welcomeEmailSentAt)))
    .returning({ id: user.id })
    .get();

  if (!claimed) return;

  // If the send throws, the claim stays set and this account never gets a
  // welcome. That's the deliberate direction to fail in: there is no queue,
  // retry, or dead-letter anywhere in this app to hand a rollback to, and an
  // unsent welcome email is a non-event while a duplicate one is a visible bug.
  await sendWelcomeEmail(account.email, account.name);
}
