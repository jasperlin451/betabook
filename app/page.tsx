import { Link } from "@heroui/react";
import { AreaSearchForm, ClimbSearchForm, ClimbSearchSortControl } from "@/components/search-form";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { PageWithStats } from "@/components/ui/page-shell";
import { getDb } from "@/db/client";
import {
  getAreaBreadcrumbs,
  getClimbSendStats,
  getUserSentClimbIds,
  searchAreas,
  searchClimbs,
} from "@/db/queries";
import {
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import { getSession } from "@/lib/session";
import type { SearchParamsRecord } from "@/lib/search-params";

type SearchPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const mode = params.mode === "area" ? "area" : "climb";
  const db = await getDb();

  if (mode === "area") {
    const name = typeof params.name === "string" ? params.name : "";
    const results = name ? await searchAreas(db, name) : [];
    const areaBreadcrumbs = await getAreaBreadcrumbs(db, results.map((a) => a.id));

    return (
      <div className="flex flex-col gap-6">
        {/* The page's content starts straight at the search controls — the
          * h1 exists for the document outline/assistive tech, not the eye. */}
        <h1 className="sr-only">Search areas</h1>
        <ModeSwitch mode={mode} />
        <PageWithStats
          statsPosition="before"
          stats={
            <div className="lg:w-80 lg:shrink-0">
              <AreaSearchForm defaultName={name} />
            </div>
          }
        >
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Results</h2>
            <AreaList
              areas={results}
              variant="search"
              areaBreadcrumbs={areaBreadcrumbs}
              emptyMessage={name ? `No areas matching "${name}".` : "Search for an area by name."}
            />
          </section>
        </PageWithStats>
      </div>
    );
  }

  const sort = parseClimbSearchSort(params);
  const filter = parseClimbSearchFilter(params);

  // No disciplines checked means the discipline/grade filter isn't active —
  // searchClimbs already matches everything when `disciplines` is empty.
  const results = await searchClimbs(db, toSearchClimbsQueryParams(filter, sort));
  const session = await getSession();
  const [sendStats, areaBreadcrumbs, sentClimbIds] = await Promise.all([
    getClimbSendStats(db, results.map((c) => c.id)),
    getAreaBreadcrumbs(db, results.map((c) => c.areaId)),
    session ? getUserSentClimbIds(db, session.user.id) : Promise.resolve(undefined),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* See the area-mode h1 above — visually the page starts at the
        * search controls. */}
      <h1 className="sr-only">Search climbs</h1>
      <ModeSwitch mode={mode} />
      <PageWithStats
        statsPosition="before"
        stats={
          <div className="lg:w-80 lg:shrink-0">
            <ClimbSearchForm defaultFilter={filter} sort={sort} />
          </div>
        }
      >
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
            <ClimbSearchSortControl sort={sort} filter={filter} />
          </div>
          <ClimbList
            climbs={results}
            sendStats={sendStats}
            areaBreadcrumbs={areaBreadcrumbs}
            sentClimbIds={sentClimbIds}
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
        href="/?mode=climb"
        className={
          mode === "climb"
            ? "rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-foreground no-underline"
            : "rounded-full px-4 py-1.5 text-sm text-muted no-underline"
        }
      >
        Search climbs
      </Link>
      <Link
        href="/?mode=area"
        className={
          mode === "area"
            ? "rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-foreground no-underline"
            : "rounded-full px-4 py-1.5 text-sm text-muted no-underline"
        }
      >
        Search areas
      </Link>
    </div>
  );
}
