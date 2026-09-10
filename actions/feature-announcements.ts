"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { featureAnnouncementDismissals } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { ANALYTICS_CUSTOMIZE_ANNOUNCEMENT } from "@/lib/feature-announcements";
import { requireSession } from "@/lib/session";

/** Stable release IDs must not change when announcement copy changes. */
export async function dismissFeatureAnnouncement(featureId: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    if (typeof featureId !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(featureId)) {
      throw new ActionError("Invalid feature announcement.");
    }
    const db = await getDb();
    await db
      .insert(featureAnnouncementDismissals)
      .values({ userId: session.user.id, featureId })
      .onConflictDoNothing();
    // Each rollout refreshes only the page that reads its dismissal state.
    if (featureId === ANALYTICS_CUSTOMIZE_ANNOUNCEMENT.featureId) {
      revalidatePath(`/users/${session.user.id}/analytics`);
    }
  });
}
