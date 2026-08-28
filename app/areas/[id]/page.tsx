import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { AreaActionsMenu } from "@/components/area-actions-menu";
import { AreaList } from "@/components/area-list";
import { AreaClimbsFilterPanel, AreaClimbsSection } from "@/components/area-climbs-section";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { getDb } from "@/db/client";
import {
  getAncestors,
  getArea,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getSubareas,
  getSubtreeClimbs,
  getUserSentClimbIds,
  hasClimbsInArea,
} from "@/db/queries";
import {
  parseAreaClimbsFilter,
  parseAreaClimbsSort,
  toSubtreeQueryFilter,
} from "@/lib/area-climbs-filter";
import { missingDescriptionMessage } from "@/lib/descriptions";
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
  const [ancestors, subareas, subtreeClimbs, hasClimbs, sentClimbIds] = await Promise.all([
    getAncestors(db, area),
    getSubareas(db, area.id),
    getSubtreeClimbs(db, area, 1, sort, toSubtreeQueryFilter(filter)),
    hasClimbsInArea(db, area.id),
    session ? getUserSentClimbIds(db, session.user.id) : undefined,
  ]);
  const canDeleteArea = subareas.length === 0 && !hasClimbs;

  const [sendStats, areaBreadcrumbs] = await Promise.all([
    getClimbSendStats(db, subtreeClimbs.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, subtreeClimbs.climbs.map((c) => c.areaId)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={ancestors} current={area} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{area.name}</h1>
          <p className="text-muted mt-1">
            {area.description || missingDescriptionMessage("area")}
          </p>
        </div>
        {session && <AreaActionsMenu area={area} canDelete={canDeleteArea} />}
      </div>

      <CollapsibleSection title="Sub-areas">
        <AreaList areas={subareas} emptyMessage="No sub-areas." />
      </CollapsibleSection>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-2 lg:order-1">
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
        </div>

        <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
          {/* Gated on lg, not CollapsibleSection's md default, to match
           * where this column switches from a stacked mobile block to the
           * sidebar (see the lg:flex-row container below). */}
          <CollapsibleSection title="Filters" breakpoint="lg" showTitleOnDesktop={false}>
            <AreaClimbsFilterPanel areaId={area.id} sort={sort} filter={filter} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
