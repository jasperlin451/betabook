import Link from "next/link";
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
        <ModeSwitch mode={mode} />
        <AreaSearchForm defaultName={name} />
        {name && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Results</h2>
            <AreaList
              areas={results}
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
    (d): d is Discipline => d === "boulder" || d === "rope",
  );
  const boulderRange = toRange(params.boulderRange, [0, BOULDER_HUECO.length - 1]);
  const ropeRange = toRange(params.ropeRange, [0, ROPE_YDS.length - 1]);

  const hasQuery = Boolean(name || areaName || disciplines.length > 0);
  const results = hasQuery
    ? await searchClimbs(db, {
        name: name || undefined,
        areaName: areaName || undefined,
        disciplines,
        boulderRange: disciplines.includes("boulder") ? boulderRange : undefined,
        ropeRange: disciplines.includes("rope") ? ropeRange : undefined,
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <ModeSwitch mode={mode} />
      <ClimbSearchForm
        defaultName={name}
        defaultAreaName={areaName}
        defaultDisciplines={disciplines}
        defaultBoulderRange={boulderRange}
        defaultRopeRange={ropeRange}
      />
      {hasQuery && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Results</h2>
          <ClimbList climbs={results} emptyMessage="No climbs match your search." />
        </section>
      )}
    </div>
  );
}

function ModeSwitch({ mode }: { mode: "area" | "climb" }) {
  return (
    <div className="flex gap-4 border-b pb-2">
      <Link
        href="/?mode=area"
        className={mode === "area" ? "font-semibold" : "text-muted-foreground"}
      >
        Search Areas
      </Link>
      <Link
        href="/?mode=climb"
        className={mode === "climb" ? "font-semibold" : "text-muted-foreground"}
      >
        Search Climbs
      </Link>
    </div>
  );
}
