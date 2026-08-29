import { Link } from "@heroui/react";
import clsx from "clsx";
import { AreaSearchForm, ClimbSearchForm, ClimbSearchSortControl } from "@/components/search-form";
import { AreaSearchResults, ClimbSearchResults } from "@/components/search-results";
import { NavigationPendingProvider, NavigationPendingRegion } from "@/components/navigation-pending";
import { PageWithStats } from "@/components/ui/page-shell";
import { getDb } from "@/db/client";
import {
  countSearchAreas,
  countSearchClimbs,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getUserSentClimbIds,
  searchAreas,
  searchClimbs,
} from "@/db/queries";
import {
  climbSearchFilterToSearchParams,
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
    // Only the first page is server-rendered — AreaSearchResults fetches
    // subsequent pages itself via "load more" (see app/api/search/areas).
    const [results, totalCount] = name
      ? await Promise.all([searchAreas(db, name), countSearchAreas(db, name)])
      : [{ areas: [], hasNextPage: false }, 0];
    const areaBreadcrumbs = await getAreaBreadcrumbs(db, results.areas.map((a) => a.id));

    const currentSearch = new URLSearchParams({ mode: "area" });
    if (name) currentSearch.set("name", name);

    return (
      <NavigationPendingProvider>
        <div className="flex flex-col gap-6">
          <ModeSwitch mode={mode} name={name} currentSearch={currentSearch.toString()} />
          <PageWithStats
            statsPosition="before"
            stats={
              <div className="lg:w-96 lg:shrink-0">
                <AreaSearchForm defaultName={name} />
              </div>
            }
          >
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">
                Results
                {name && <ResultCount count={totalCount} />}
              </h2>
              <NavigationPendingRegion>
                <AreaSearchResults
                  key={name}
                  name={name}
                  initialAreas={results.areas}
                  initialHasNextPage={results.hasNextPage}
                  initialAreaBreadcrumbs={areaBreadcrumbs}
                  emptyMessage={name ? `No areas matching "${name}".` : "Search for an area by name."}
                />
              </NavigationPendingRegion>
            </section>
          </PageWithStats>
        </div>
      </NavigationPendingProvider>
    );
  }

  const sort = parseClimbSearchSort(params);
  const filter = parseClimbSearchFilter(params);

  // No disciplines checked means the discipline/grade filter isn't active —
  // searchClimbs already matches everything when `disciplines` is empty.
  // Only the first page is server-rendered — ClimbSearchResults fetches
  // subsequent pages itself via "load more" (see app/api/search/climbs).
  const queryParams = toSearchClimbsQueryParams(filter, sort);
  const [results, totalCount] = await Promise.all([
    searchClimbs(db, queryParams),
    countSearchClimbs(db, queryParams),
  ]);
  const session = await getSession();
  const [sendStats, areaBreadcrumbs, sentClimbIds] = await Promise.all([
    getClimbSendStats(db, results.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, results.climbs.map((c) => c.areaId)),
    session ? getUserSentClimbIds(db, session.user.id) : Promise.resolve(undefined),
  ]);

  return (
    <NavigationPendingProvider>
      <div className="flex flex-col gap-6">
        <ModeSwitch
          mode={mode}
          name={filter.name}
          currentSearch={climbSearchFilterToSearchParams(sort, filter).toString()}
        />
        <PageWithStats
          statsPosition="before"
          stats={
            <div className="lg:w-96 lg:shrink-0">
              <ClimbSearchForm defaultFilter={filter} sort={sort} />
            </div>
          }
        >
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                Results
                <ResultCount count={totalCount} />
              </h2>
              <ClimbSearchSortControl sort={sort} filter={filter} />
            </div>
            <NavigationPendingRegion>
              <ClimbSearchResults
                key={climbSearchFilterToSearchParams(sort, filter).toString()}
                sort={sort}
                filter={filter}
                initialClimbs={results.climbs}
                initialHasNextPage={results.hasNextPage}
                initialSendStats={sendStats}
                initialAreaBreadcrumbs={areaBreadcrumbs}
                sentClimbIds={sentClimbIds}
              />
            </NavigationPendingRegion>
          </section>
        </PageWithStats>
      </div>
    </NavigationPendingProvider>
  );
}

/** The match total shown next to the "Results" heading — an exact COUNT(*)
 * computed alongside the first page's query (see countSearchClimbs), so
 * "load more" is visibly worth pressing instead of results silently capping. */
function ResultCount({ count }: { count: number }) {
  return (
    <span className="text-muted ml-1.5 text-sm font-normal">
      ({count.toLocaleString("en-US")})
    </span>
  );
}

function ModeSwitch({
  mode,
  name,
  currentSearch,
}: {
  mode: "area" | "climb";
  /** The typed name — the one search param both modes understand, so it
   * carries across a mode switch. */
  name?: string;
  /** The active mode's full current query string, so the active pill links
   * to exactly where the user already is (keeping sort/filters) instead of
   * resetting them. */
  currentSearch: string;
}) {
  function hrefFor(target: "area" | "climb"): string {
    if (target === mode) return `/?${currentSearch}`;
    // Cross-mode: the name transfers, everything else is mode-specific
    // (sort, disciplines, grade/rating ranges) and resets to defaults.
    const params = new URLSearchParams({ mode: target });
    if (name) params.set("name", name);
    return `/?${params.toString()}`;
  }

  function pillClass(active: boolean): string {
    return clsx(
      "rounded-full px-4 py-1.5 text-sm no-underline",
      active ? "bg-background font-semibold text-foreground" : "text-muted",
    );
  }

  return (
    <div className="inline-flex gap-1 self-start rounded-full bg-surface-secondary p-1">
      <Link
        href={hrefFor("climb")}
        className={pillClass(mode === "climb")}
        aria-current={mode === "climb" ? "page" : undefined}
      >
        Search climbs
      </Link>
      <Link
        href={hrefFor("area")}
        className={pillClass(mode === "area")}
        aria-current={mode === "area" ? "page" : undefined}
      >
        Search areas
      </Link>
    </div>
  );
}
