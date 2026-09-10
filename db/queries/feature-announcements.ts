import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { featureAnnouncementDismissals } from "@/db/schema";

/** Pass the authenticated viewer's ID, never the profile/page owner's ID. */
export async function isFeatureAnnouncementDismissed(
  db: Database,
  userId: string,
  featureId: string,
) {
  const row = await db
    .select({ featureId: featureAnnouncementDismissals.featureId })
    .from(featureAnnouncementDismissals)
    .where(
      and(
        eq(featureAnnouncementDismissals.userId, userId),
        eq(featureAnnouncementDismissals.featureId, featureId),
      ),
    )
    .get();
  return Boolean(row);
}
