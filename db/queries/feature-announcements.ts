import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import { featureAnnouncementDismissals } from "@/db/schema";
import {
  FEATURE_ANNOUNCEMENTS,
  getAnnouncementCandidates,
  type FeatureAnnouncementDefinition,
} from "@/lib/feature-announcements";

/** One indexed read for this viewer and the eligible IDs, with no per-feature queries. */
export async function getDismissedFeatureAnnouncementIds(
  db: Database,
  userId: string,
  featureIds: readonly string[],
): Promise<string[]> {
  if (featureIds.length === 0) return [];
  const rows = await db
    .select({ featureId: featureAnnouncementDismissals.featureId })
    .from(featureAnnouncementDismissals)
    .where(
      and(
        eq(featureAnnouncementDismissals.userId, userId),
        inArray(featureAnnouncementDismissals.featureId, [...featureIds]),
      ),
    );
  return rows.map((row) => row.featureId);
}

/** Use the signed-in viewer's immutable signup date, never the viewed profile's date.
 * availableFeatureIds lists the targets actually rendered for this viewer/page state.
 * Historical/future releases require no dismissal rows and no database lookup. */
export async function getPageFeatureAnnouncements(
  db: Database,
  viewer: { id: string; createdAt: Date },
  {
    page,
    availableFeatureIds,
    now = new Date(),
    definitions = FEATURE_ANNOUNCEMENTS,
  }: {
    page: string;
    availableFeatureIds: readonly string[];
    now?: Date;
    definitions?: readonly FeatureAnnouncementDefinition[];
  },
): Promise<FeatureAnnouncementDefinition[]> {
  const candidates = getAnnouncementCandidates(definitions, {
    page,
    availableFeatureIds,
    userCreatedAt: viewer.createdAt,
    now,
  });
  const dismissed = new Set(
    await getDismissedFeatureAnnouncementIds(
      db,
      viewer.id,
      candidates.map((feature) => feature.featureId),
    ),
  );
  return candidates.filter((feature) => !dismissed.has(feature.featureId));
}
