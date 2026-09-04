"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { user } from "@/db/schema";
import { toActionResult, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/session";

/** Toggles whether the signed-in user's profile and sends are hidden from
 * everyone but themselves (see lib/user-visibility.ts). Only the two profile
 * pages are revalidated here — a toggle doesn't fan out to every climb page
 * the user has ever sent, which for an active climber can run into the
 * thousands; those pick up the change on their own next revalidation, the
 * same eventual-consistency window every other cached page already accepts. */
export async function setUserPrivate(isPrivate: boolean): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    await db.update(user).set({ isPrivate }).where(eq(user.id, session.user.id));

    revalidatePath(`/users/${session.user.id}`);
    revalidatePath(`/users/${session.user.id}/analytics`);
    refresh();
  });
}
