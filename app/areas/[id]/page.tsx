import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { AreaList } from "@/components/area-list";
import { AreaClimbsFilterPanel, AreaClimbsSection } from "@/components/area-climbs-section";
import { getDb } from "@/db/client";
import {
  getAncestors,
  getArea,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getSubareas,
  getSubtreeClimbs,
  getUserSentClimbIds,
  type Discipline,
  type SubtreeClimbsSort,
} from "@/db/queries";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { initAuth } from "@/lib/auth";

const SUBTREE_CLIMBS_SORTS: SubtreeClimbsSort[] = [
  "name_asc",
  "name_desc",
  "grade_asc",
  "grade_desc",
  "rating_asc",
  "rating_desc",
  "ascents_asc",
  "ascents_desc",
];

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toRange(
  value: string | string[] | undefined,
  fallback: [number, number],
): [number, number] {
  const values = toArray(value).map(Number).filter(Number.isFinite);
  if (values.length < 2) return fallback;
  return [Math.min(...values), Math.max(...values)];
}

type AreaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AreaPage({ params, searchParams }: AreaPageProps) {
  const { id } = await params;
  const search = await searchParams;
  const areaId = Number(id);

  if (!Number.isInteger(areaId)) notFound();

  const db = await getDb();
  const area = await getArea(db, areaId);
  if (!area) notFound();

  const page = Math.max(1, Number(search.page) || 1);
  const sort = SUBTREE_CLIMBS_SORTS.includes(search.sort as SubtreeClimbsSort)
    ? (search.sort as SubtreeClimbsSort)
    : "ascents_desc";

  // Same name/discipline/grade filter, and the same "only pass a range for a
  // checked discipline" convention, as the climb search page.
  const name = typeof search.name === "string" ? search.name : "";
  const disciplines = toArray(search.discipline).filter(
    (d): d is Discipline => d === "boulder" || d === "sport" || d === "trad",
  );
  const boulderRange = toRange(search.boulderRange, [0, BOULDER_HUECO.length - 1]);
  const sportRange = toRange(search.sportRange, [0, ROPE_YDS.length - 1]);
  const tradRange = toRange(search.tradRange, [0, ROPE_YDS.length - 1]);
  const filter = {
    name,
    disciplines,
    boulderRange,
    sportRange,
    tradRange,
  };

  const [ancestors, subareas, subtreeClimbs] = await Promise.all([
    getAncestors(db, area),
    getSubareas(db, area.id),
    getSubtreeClimbs(db, area, page, sort, {
      name: name || undefined,
      disciplines,
      boulderRange: disciplines.includes("boulder") ? boulderRange : undefined,
      sportRange: disciplines.includes("sport") ? sportRange : undefined,
      tradRange: disciplines.includes("trad") ? tradRange : undefined,
    }),
  ]);

  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const [sendStats, areaBreadcrumbs, sentClimbIds] = await Promise.all([
    getClimbSendStats(db, subtreeClimbs.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, subtreeClimbs.climbs.map((c) => c.areaId)),
    session ? getUserSentClimbIds(db, session.user.id) : Promise.resolve(undefined),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={ancestors} current={area} />

      <div>
        <h1 className="text-2xl font-semibold">{area.name}</h1>
        {area.description && (
          <p className="text-muted mt-1">{area.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Sub-areas</h2>
        <AreaList areas={subareas} emptyMessage="No sub-areas." />
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-2 lg:order-1">
          <AreaClimbsSection
            areaId={area.id}
            sort={sort}
            filter={filter}
            climbs={subtreeClimbs.climbs}
            sendStats={sendStats}
            areaBreadcrumbs={areaBreadcrumbs}
            sentClimbIds={sentClimbIds}
            emptyMessage="No climbs found in this area or its sub-areas."
            pagination={{
              page: subtreeClimbs.page,
              hasNextPage: subtreeClimbs.hasNextPage,
            }}
          />
        </div>

        <div className="order-1 lg:order-2 lg:w-72 lg:shrink-0">
          <AreaClimbsFilterPanel areaId={area.id} sort={sort} filter={filter} />
        </div>
      </div>
    </div>
  );
}
