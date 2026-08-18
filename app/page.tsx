import { Link } from "@heroui/react";
import { AreaSearchForm, ClimbSearchForm } from "@/components/search-form";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { getDb } from "@/db/client";
import { searchAreas, searchClimbs, type Discipline } from "@/db/queries";
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
        <h1 className="text-3xl font-bold">Directory Search</h1>
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
  // No discipline param at all means a fresh, unsearched form — treat it the
  // same as "all three checked" rather than filtering everything out.
  const effectiveDisciplines: Discipline[] =
    disciplines.length > 0 ? disciplines : ["boulder", "sport", "trad"];

  const results = await searchClimbs(db, {
    name: name || undefined,
    areaName: areaName || undefined,
    disciplines: effectiveDisciplines,
    boulderRange: effectiveDisciplines.includes("boulder") ? boulderRange : undefined,
    sportRange: effectiveDisciplines.includes("sport") ? sportRange : undefined,
    tradRange: effectiveDisciplines.includes("trad") ? tradRange : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Directory Search</h1>
      <ModeSwitch mode={mode} />
      <ClimbSearchForm
        defaultName={name}
        defaultAreaName={areaName}
        defaultDisciplines={disciplines.length > 0 ? disciplines : undefined}
        defaultBoulderRange={params.boulderRange !== undefined ? boulderRange : undefined}
        defaultSportRange={params.sportRange !== undefined ? sportRange : undefined}
        defaultTradRange={params.tradRange !== undefined ? tradRange : undefined}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Results</h2>
        <ClimbList
          climbs={results}
          variant="search"
          emptyMessage="No climbs match your search."
        />
      </section>
    </div>
  );
}

function ModeSwitch({ mode }: { mode: "area" | "climb" }) {
  return (
    <div className="flex gap-2 border-b border-separator">
      <Link
        href="/?mode=area"
        className={
          mode === "area"
            ? "rounded-t-lg border border-b-0 border-separator bg-background px-4 py-2 font-semibold text-foreground no-underline"
            : "px-4 py-2 text-muted no-underline"
        }
      >
        Area Search
      </Link>
      <Link
        href="/?mode=climb"
        className={
          mode === "climb"
            ? "rounded-t-lg border border-b-0 border-separator bg-background px-4 py-2 font-semibold text-foreground no-underline"
            : "px-4 py-2 text-muted no-underline"
        }
      >
        Climb Search
      </Link>
    </div>
  );
}
