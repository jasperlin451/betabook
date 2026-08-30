import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { AreaActionsMenu } from "@/components/area-actions-menu";
import { AreaCragHeader } from "@/components/area-crag-header";
import { AreaList } from "@/components/area-list";
import { AreaClimbsFilterPanel, AreaClimbsSection } from "@/components/area-climbs-section";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { SidebarLayout } from "@/components/ui/page-shell";
import { getDb } from "@/db/client";
import {
  getAncestors,
  getArea,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getSubareas,
  getSubtreeClimbs,
  getSubtreeGradeHistogram,
  getUserSentClimbIds,
  hasClimbsInArea,
  LARGE_AREA_SUBTREE_SPAN,
} from "@/db/queries";
import {
  parseAreaClimbsFilter,
  parseAreaClimbsSort,
  toSubtreeQueryFilter,
} from "@/lib/area-climbs-filter";
import { buildGradeHistogram } from "@/lib/grade-histogram";
import { getSession } from "@/lib/session";
import type { SearchParamsRecord } from "@/lib/search-params";

type AreaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

// generateMetadata and the page both need the area. The query helpers are
// plain async functions keyed on a per-call db handle, so memoizing them
// directly would never hit — memoize the whole id -> area lookup with React
// cache() instead, so the two consumers share one query per request.
const getAreaById = cache(async (id: number) => {
  const db = await getDb();
  return getArea(db, id);
});

export async function generateMetadata({ params }: AreaPageProps): Promise<Metadata> {
  const { id } = await params;
  const areaId = Number(id);
  if (!Number.isInteger(areaId)) notFound();

  const area = await getAreaById(areaId);
  if (!area) notFound();

  return { title: area.name };
}

export default async function AreaPage({ params, searchParams }: AreaPageProps) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const areaId = Number(id);

  if (!Number.isInteger(areaId)) notFound();

  // Grouped by dependency tier so independent fetches overlap instead of
  // waterfalling — the db handle, the area row, and the session don't depend
  // on each other.
  const [db, area, session] = await Promise.all([getDb(), getAreaById(areaId), getSession()]);
  if (!area) notFound();

  const sort = parseAreaClimbsSort(search);
  const filter = parseAreaClimbsFilter(search);

  // Only the first page is server-rendered — AreaClimbsSection fetches
  // subsequent pages itself via "load more" (see app/api/areas/[id]/climbs).
  // The histogram reads every climb row in the subtree, so it follows the
  // same size gate as the list's index strategy — a continent-scale area
  // renders its header without the strip/chart instead of scanning tens of
  // thousands of rows per view. The lft=rght=0 check skips areas created
  // but not yet reindexed, whose placeholder range would falsely match
  // every other unindexed climb.
  const histogramEligible =
    !(area.lft === 0 && area.rght === 0) && area.rght - area.lft < LARGE_AREA_SUBTREE_SPAN;

  const [ancestors, subareas, subtreeClimbs, hasClimbs, sentClimbIds, histogramRows] =
    await Promise.all([
      getAncestors(db, area),
      getSubareas(db, area.id),
      getSubtreeClimbs(db, area, 1, sort, toSubtreeQueryFilter(filter)),
      hasClimbsInArea(db, area.id),
      session ? getUserSentClimbIds(db, session.user.id) : undefined,
      histogramEligible ? getSubtreeGradeHistogram(db, area) : [],
    ]);
  const canDeleteArea = subareas.length === 0 && !hasClimbs;
  const histogram = buildGradeHistogram(histogramRows);

  const [sendStats, areaBreadcrumbs] = await Promise.all([
    getClimbSendStats(db, subtreeClimbs.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, subtreeClimbs.climbs.map((c) => c.areaId)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={ancestors} current={area} />

      <AreaCragHeader
        area={area}
        histogram={histogram}
        isEditor={session != null}
        actions={session && <AreaActionsMenu area={area} canDelete={canDeleteArea} />}
      />

      {subareas.length > 0 && (
        <CollapsibleSection title="Sub-areas">
          <AreaList areas={subareas} />
        </CollapsibleSection>
      )}

      {/* The provider links the filter panel's in-flight navigation to the
       * climb list it re-fetches, which dims while pending. */}
      <NavigationPendingProvider>
        <SidebarLayout
          sidebar={
            /* Gated on lg, not CollapsibleSection's md default, to match
             * where this column switches from a stacked mobile block to the
             * sidebar (see SidebarLayout's lg:flex-row container). */
            <CollapsibleSection title="Filters" breakpoint="lg" showTitleOnDesktop={false}>
              <AreaClimbsFilterPanel areaId={area.id} sort={sort} filter={filter} />
            </CollapsibleSection>
          }
        >
          <AreaClimbsSection
            // Remounts with fresh initial* state on a sort/filter change,
            // rather than syncing local "load more" state to changed props
            // via an effect — same reasoning as UserSendList.
            key={JSON.stringify({ sort, filter })}
            areaId={area.id}
            sort={sort}
            filter={filter}
            initialClimbs={subtreeClimbs.climbs}
            initialHasNextPage={subtreeClimbs.hasNextPage}
            initialSendStats={sendStats}
            initialAreaBreadcrumbs={areaBreadcrumbs}
            sentClimbIds={sentClimbIds}
            emptyMessage="No climbs found in this area or its sub-areas."
          />
        </SidebarLayout>
      </NavigationPendingProvider>
    </div>
  );
}
