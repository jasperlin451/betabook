export interface FeatureAnnouncementDefinition {
  readonly featureId: string;
  /** UTC timestamp when the feature became available, fixed across copy edits. */
  readonly launchedAt: string;
  /** Route template; [id] represents the signed-in viewer. */
  readonly page: string;
  readonly title: string;
  readonly description: string;
}

/** Release IDs and launch dates stay stable when copy changes. */
export const ANALYTICS_CUSTOMIZE_ANNOUNCEMENT = {
  featureId: "analytics-customize",
  // Deploy step completed: https://github.com/jasperlin451/betabook/actions/runs/34325083656 (PR #176).
  launchedAt: "2026-09-09T07:51:58Z",
  page: "/users/[id]/analytics",
  title: "Make Analytics your own",
  description:
    "Add new cards and charts, choose what to show, and arrange your dashboard with Customize. Changes only affect your own view.",
} as const satisfies FeatureAnnouncementDefinition;

export const FEATURE_ANNOUNCEMENTS: readonly FeatureAnnouncementDefinition[] = [
  ANALYTICS_CUSTOMIZE_ANNOUNCEMENT,
];

export function getAnnouncementCandidates(
  definitions: readonly FeatureAnnouncementDefinition[],
  {
    page,
    availableFeatureIds,
    userCreatedAt,
    now,
  }: {
    page: string;
    availableFeatureIds: readonly string[];
    userCreatedAt: Date;
    now: Date;
  },
): FeatureAnnouncementDefinition[] {
  const available = new Set(availableFeatureIds);
  const joined = userCreatedAt.getTime();
  const current = now.getTime();
  return definitions
    .filter((feature) => {
      const launch = Date.parse(feature.launchedAt);
      return (
        feature.page === page &&
        available.has(feature.featureId) &&
        joined < launch &&
        launch <= current
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.launchedAt) - Date.parse(b.launchedAt) ||
        a.featureId.localeCompare(b.featureId),
    );
}
