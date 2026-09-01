"use client";

import { useRouter } from "next/navigation";
import { AreaSearchField } from "@/components/area-search-field";
import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { FilterToolbar } from "@/components/filter-toolbar";
import { RouteSearchField } from "@/components/route-search-field";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  climbSearchFilterToSearchParams,
  DEFAULT_CLIMB_SEARCH_FILTER,
  DEFAULT_CLIMB_SEARCH_SORT,
  type ClimbSearchFilter,
} from "@/lib/climb-search-filter";
import type { SubtreeClimbsSort } from "@/db/queries";

/** Area search's one control: the name field, in the toolbar position the
 * climb toolbar occupies so switching modes keeps the page's shape. Auto-
 * searches: each edit debounces into a single navigation, firing only when
 * the built URL differs from the current one. */
export function AreaSearchToolbar({ defaultName = "" }: { defaultName?: string }) {
  const { name, setName } = useFilterFormNavigation({
    initialFilter: null,
    initialName: defaultName,
    defaultFilter: null,
    buildHref: (_filter, name) => {
      const params = new URLSearchParams({ mode: "area" });
      if (name) params.set("name", name);
      return `/?${params.toString()}`;
    },
  });

  return (
    // A filter, not a navigator: the results list below is what takes you
    // to an area, so picking a suggestion just completes the name — which is
    // how you tell two same-named crags apart before committing to one.
    <AreaSearchField
      value={name}
      onChange={setName}
      onSelect={(area) => setName(area.name)}
      ariaLabel="Search area name"
      className="w-full sm:w-96"
    />
  );
}

function buildSearchHref(sort: SubtreeClimbsSort, filter: ClimbSearchFilter): string {
  return `/?${climbSearchFilterToSearchParams(sort, filter).toString()}`;
}

/** Climb search's filters, in the same one-row toolbar the area page and a
 * climber's send history use — route search on the bar, area scope with the
 * secondary filters behind "More filters", sort pushed right — so narrowing
 * a list is one control wherever a list is narrowed. Auto-searches like the
 * area toolbar; sort is preserved across filter edits except on reset. */
export function ClimbSearchToolbar({
  filter = DEFAULT_CLIMB_SEARCH_FILTER,
  sort = DEFAULT_CLIMB_SEARCH_SORT,
}: {
  filter?: ClimbSearchFilter;
  sort?: SubtreeClimbsSort;
}) {
  const router = useRouter();
  const { name, setName, areaName, setAreaName, filter: value, setFilter: setValue, reset } =
    useFilterFormNavigation({
      initialFilter: filter,
      initialName: filter.name ?? "",
      initialAreaName: filter.areaName ?? "",
      defaultFilter: DEFAULT_CLIMB_SEARCH_FILTER,
      sort,
      defaultSort: DEFAULT_CLIMB_SEARCH_SORT,
      buildHref: (value, name, areaName, effectiveSort = sort) =>
        buildSearchHref(effectiveSort, { ...value, name, areaName }),
    });

  return (
    <FilterToolbar
      value={value}
      onChange={setValue}
      onReset={reset}
      search={
        <RouteSearchField
          value={name}
          onChange={setName}
          onSelect={(route) => setName(route.name)}
          ariaLabel="Search route name"
          className="w-full sm:w-64"
        />
      }
      sortControl={
        <ClimbListSortControl
          sort={sort}
          onNavigate={(nextSort) =>
            router.replace(buildSearchHref(nextSort, filter), { scroll: false })
          }
        />
      }
      extraFilters={
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 text-sm font-medium text-foreground">In area</span>
            <AreaSearchField
              value={areaName}
              onChange={setAreaName}
              onSelect={(area) => setAreaName(area.name)}
              ariaLabel="Filter by area"
              placeholder="Anywhere"
              className="w-full sm:w-64"
            />
          </div>
          <ClimbStatsFields
            ratingRange={value.ratingRange}
            onRatingRangeChange={(ratingRange) => setValue({ ...value, ratingRange })}
            minAscents={value.minAscents}
            onMinAscentsChange={(minAscents) => setValue({ ...value, minAscents })}
          />
        </>
      }
    />
  );
}
