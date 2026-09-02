import { clsx } from "clsx";

import { HomeSearchEntry } from "@/components/command-palette";
import {
  NavigationPendingProvider,
  NavigationPendingRegion,
} from "@/components/navigation-pending";
import { RecentSendsFeed } from "@/components/recent-sends-feed";
import { AreaSearchToolbar, ClimbSearchToolbar } from "@/components/search-form";
import { AreaSearchResults, ClimbSearchResults } from "@/components/search-results";
import { AppLink } from "@/components/ui/app-link";
import { SectionHeading } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import {
  countSearchAreas,
  countSearchClimbs,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getRecentSends,
  getUserSentClimbIds,
  searchAreas,
  searchClimbs,
} from "@/db/queries";
import {
  climbSearchFilterToSearchParams,
  DEFAULT_CLIMB_SEARCH_FILTER,
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import type { SearchParamsRecord } from "@/lib/search-params";
import { getSession } from "@/lib/session";

type SearchPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const db = await getDb();

  // Bare `/` is the home feed — the latest sends across the whole book. The
  // way in to search is the header's ⌘K palette, which reaches both routes
  // and areas from every page, so the feed doesn't carry a bar of its own.
  // Any search param at all (a query, a mode, a filter) switches to the full
  // search view below.
  if (Object.keys(params).length === 0) {
    const feed = await getRecentSends(db, 1);
    const areaBreadcrumbs = await getAreaBreadcrumbs(
      db,
      feed.sends.map((send) => send.areaId),
    );

    return (
      <div className="flex flex-col gap-8 pt-4">
        <h1 className="sr-only">Betabook</h1>

        {/* Search leads: it is how someone arrives looking for a route, and
         * the feed below is what they read when they aren't. The header's
         * icon is enough once you know the site, but it is far too quiet to
         * be the only search on a landing page — especially on a phone,
         * where the keyboard shortcut it stands for doesn't exist. */}
        <section className="mx-auto w-full max-w-3xl">
          <HomeSearchEntry />
        </section>

        <section className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <SectionHeading>Recent sends</SectionHeading>
          <RecentSendsFeed
            initialSends={feed.sends}
            initialHasMore={feed.hasMore}
            initialAreaBreadcrumbs={areaBreadcrumbs}
          />
        </section>
      </div>
    );
  }

  const mode = params.mode === "area" ? "area" : "climb";

  if (mode === "area") {
    const name = typeof params.name === "string" ? params.name : "";
    // Only the first page is server-rendered — AreaSearchResults fetches
    // subsequent pages itself via "load more" (see app/api/search/areas).
    const [results, totalCount] = name
      ? await Promise.all([searchAreas(db, name), countSearchAreas(db, name)])
      : [{ areas: [], hasNextPage: false }, 0];
    const areaBreadcrumbs = await getAreaBreadcrumbs(
      db,
      results.areas.map((a) => a.id),
    );

    const currentSearch = new URLSearchParams({ mode: "area" });
    if (name) currentSearch.set("name", name);

    return (
      <NavigationPendingProvider>
        <div className="flex flex-col gap-6">
          {/* The page's content starts straight at the search controls — the
           * h1 exists for the document outline/assistive tech, not the eye. */}
          <h1 className="sr-only">Search areas</h1>
          <ModeSwitch mode={mode} name={name} currentSearch={currentSearch.toString()} />
          <section className="flex flex-col gap-3">
            <SectionHeading>
              Results
              {name && <ResultCount count={totalCount} />}
            </SectionHeading>
            <AreaSearchToolbar defaultName={name} />
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
  // The searches and the session lookup don't depend on each other.
  //
  // Counting only happens once something is actually filtered: the default
  // landing would otherwise COUNT(*) every climb (a full index scan billed
  // on every visit) just to caption an unfiltered list. Canonical
  // serialization is the comparison the filter libs already treat as
  // identity (see their fixed-point tests); sort cancels out.
  const searchActive =
    climbSearchFilterToSearchParams(sort, filter).toString() !==
    climbSearchFilterToSearchParams(sort, DEFAULT_CLIMB_SEARCH_FILTER).toString();
  const queryParams = toSearchClimbsQueryParams(filter, sort);
  const [results, totalCount, session] = await Promise.all([
    searchClimbs(db, queryParams),
    searchActive ? countSearchClimbs(db, queryParams) : null,
    getSession(),
  ]);
  const [sendStats, areaBreadcrumbs, sentClimbIds] = await Promise.all([
    getClimbSendStats(
      db,
      results.climbs.map((c) => c.id),
    ),
    getAreaBreadcrumbs(
      db,
      results.climbs.map((c) => c.areaId),
    ),
    session
      ? getUserSentClimbIds(
          db,
          session.user.id,
          results.climbs.map((climb) => climb.id),
        )
      : Promise.resolve(undefined),
  ]);

  return (
    <NavigationPendingProvider>
      <div className="flex flex-col gap-6">
        {/* See the area-mode h1 above — visually the page starts at the
         * search controls. */}
        <h1 className="sr-only">Search climbs</h1>
        <ModeSwitch
          mode={mode}
          name={filter.name}
          currentSearch={climbSearchFilterToSearchParams(sort, filter).toString()}
        />
        <section className="flex flex-col gap-3">
          <SectionHeading>
            Results
            {totalCount != null && <ResultCount count={totalCount} />}
          </SectionHeading>
          <ClimbSearchToolbar filter={filter} sort={sort} />
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
      </div>
    </NavigationPendingProvider>
  );
}

/** The match total shown next to the "Results" heading — an exact COUNT(*)
 * computed alongside the first page's query (see countSearchClimbs), so
 * "load more" is visibly worth pressing instead of results silently capping. */
function ResultCount({ count }: { count: number }) {
  return (
    <span className="ml-1.5 text-sm font-normal text-muted">({count.toLocaleString("en-US")})</span>
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
    // The active pill wears HeroUI's segment tokens (the same pair its own
    // segmented controls use) instead of a hand-picked background.
    return clsx(
      "rounded-full px-4 py-1.5 text-sm no-underline",
      active ? "bg-segment font-semibold text-segment-foreground" : "text-muted",
    );
  }

  return (
    <div className="inline-flex gap-1 self-start rounded-full bg-surface-secondary p-1">
      <AppLink
        href={hrefFor("climb")}
        className={pillClass(mode === "climb")}
        aria-current={mode === "climb" ? "page" : undefined}
      >
        Search climbs
      </AppLink>
      <AppLink
        href={hrefFor("area")}
        className={pillClass(mode === "area")}
        aria-current={mode === "area" ? "page" : undefined}
      >
        Search areas
      </AppLink>
    </div>
  );
}
