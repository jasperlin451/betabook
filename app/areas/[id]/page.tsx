import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { AreaActionsMenu } from "@/components/area-actions-menu";
import { AreaClimbsSection } from "@/components/area-climbs-section";
import { AreaClimbsToolbar } from "@/components/area-climbs-toolbar";
import { AreaCragHeader } from "@/components/area-crag-header";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { SubareaRail } from "@/components/subarea-rail";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { SidebarLayout } from "@/components/ui/page-shell";
import { SectionHeading } from "@/components/ui/typography";
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
  resolveSubareaScope,
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

  // The sub-area rail can scope the list to one sub-area's subtree; the
  // header, histogram, and rail always describe the whole area.
  const listScope = await resolveSubareaScope(db, area, filter.subareaId);

  const [ancestors, subareas, subtreeClimbs, hasClimbs, sentClimbIds, histogramRows] =
    await Promise.all([
      getAncestors(db, area),
      getSubareas(db, area.id),
      getSubtreeClimbs(db, listScope, 1, sort, toSubtreeQueryFilter(filter)),
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
        filter={filter}
        actions={session && <AreaActionsMenu area={area} canDelete={canDeleteArea} />}
      />

      {/* The provider links the toolbar's in-flight navigation to the climb
       * list it re-fetches, which dims while pending. */}
      <NavigationPendingProvider>
        {(() => {
          const climbsBlock = (
            <div className="flex flex-col gap-3">
              <SectionHeading>Climbs</SectionHeading>
              <AreaClimbsToolbar areaId={area.id} sort={sort} filter={filter} />
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
                emptyMessage={
                  filter.subareaId != null
                    ? "No climbs match in this sub-area."
                    : "No climbs found in this area or its sub-areas."
                }
              />
            </div>
          );

          if (subareas.length === 0) return climbsBlock;

          return (
            <SidebarLayout
              sidebarWidthClass="lg:w-64"
              sidebar={
                /* Gated on lg to match where the rail becomes a side column;
                 * on mobile it's a collapsed accordion above the list. */
                <CollapsibleSection title="Sub-areas" breakpoint="lg">
                  <SubareaRail
                    areaId={area.id}
                    sort={sort}
                    filter={filter}
                    subareas={subareas.map(({ id, name }) => ({ id, name }))}
                  />
                </CollapsibleSection>
              }
            >
              {climbsBlock}
            </SidebarLayout>
          );
        })()}
      </NavigationPendingProvider>
    </div>
  );
}
