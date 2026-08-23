import { Link } from "@heroui/react";
import { AreaSearchForm, ClimbSearchForm } from "@/components/search-form";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { PageWithStats } from "@/components/ui/page-shell";
import { getDb } from "@/db/client";
import {
  getAreaBreadcrumbs,
  getClimbSendStats,
  searchAreas,
  searchClimbs,
  type Discipline,
} from "@/db/queries";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const mode = params.mode === "climb" ? "climb" : "area";
  const db = await getDb();

  if (mode === "area") {
    const name = typeof params.name === "string" ? params.name : "";
    const results = name ? await searchAreas(db, name) : [];

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Find an area.</h1>
          <p className="text-muted mt-1">Search the directory by crag or area name.</p>
        </div>
        <ModeSwitch mode={mode} />
        <AreaSearchForm defaultName={name} />
        {name && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Results</h2>
            <AreaList
              areas={results}
              variant="link"
              emptyMessage={`No areas matching "${name}".`}
            />
          </section>
        )}
      </div>
    );
  }

  const name = typeof params.name === "string" ? params.name : "";
  const areaName = typeof params.areaName === "string" ? params.areaName : "";
  const disciplines = toArray(params.discipline).filter(
    (d): d is Discipline => d === "boulder" || d === "sport" || d === "trad",
  );
  const boulderRange = toRange(params.boulderRange, [0, BOULDER_HUECO.length - 1]);
  const sportRange = toRange(params.sportRange, [0, ROPE_YDS.length - 1]);
  const tradRange = toRange(params.tradRange, [0, ROPE_YDS.length - 1]);

  // No disciplines checked means the discipline/grade filter isn't active —
  // searchClimbs already matches everything when `disciplines` is empty.
  const results = await searchClimbs(db, {
    name: name || undefined,
    areaName: areaName || undefined,
    disciplines,
    boulderRange: disciplines.includes("boulder") ? boulderRange : undefined,
    sportRange: disciplines.includes("sport") ? sportRange : undefined,
    tradRange: disciplines.includes("trad") ? tradRange : undefined,
  });
  const sendStats = await getClimbSendStats(db, results.map((c) => c.id));
  const areaBreadcrumbs = await getAreaBreadcrumbs(db, results.map((c) => c.areaId));

  return (
    <div className="flex flex-col gap-6">
      <ModeSwitch mode={mode} />
      <PageWithStats
        statsPosition="before"
        stats={
          <div className="lg:w-96 lg:shrink-0">
            <ClimbSearchForm
              defaultName={name}
              defaultAreaName={areaName}
              defaultDisciplines={disciplines.length > 0 ? disciplines : undefined}
              defaultBoulderRange={params.boulderRange !== undefined ? boulderRange : undefined}
              defaultSportRange={params.sportRange !== undefined ? sportRange : undefined}
              defaultTradRange={params.tradRange !== undefined ? tradRange : undefined}
            />
          </div>
        }
      >
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Results</h2>
          <ClimbList
            climbs={results}
            variant="search"
            sendStats={sendStats}
            areaBreadcrumbs={areaBreadcrumbs}
            emptyMessage="No climbs match your search."
          />
        </section>
      </PageWithStats>
    </div>
  );
}

function ModeSwitch({ mode }: { mode: "area" | "climb" }) {
  return (
    <div className="inline-flex gap-1 self-start rounded-full bg-surface-secondary p-1">
      <Link
        href="/?mode=area"
        className={
          mode === "area"
            ? "rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-foreground no-underline"
            : "rounded-full px-4 py-1.5 text-sm text-muted no-underline"
        }
      >
        Search by area
      </Link>
      <Link
        href="/?mode=climb"
        className={
          mode === "climb"
            ? "rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-foreground no-underline"
            : "rounded-full px-4 py-1.5 text-sm text-muted no-underline"
        }
      >
        Search by climb
      </Link>
    </div>
  );
}
