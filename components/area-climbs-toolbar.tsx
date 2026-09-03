"use client";

import { useRouter } from "next/navigation";

import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { FilterToolbar } from "@/components/filter-toolbar";
import { RouteSearchField } from "@/components/route-search-field";
import type { SubtreeClimbsSort } from "@/db/queries";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  areaClimbsFilterToSearchParams,
  DEFAULT_AREA_CLIMBS_FILTER,
  DEFAULT_AREA_CLIMBS_SORT,
  type AreaClimbsFilter,
} from "@/lib/area-climbs-filter";

function buildClimbsHref(
  areaPath: string,
  sort: SubtreeClimbsSort,
  filter: AreaClimbsFilter,
): string {
  return `${areaPath}?${areaClimbsFilterToSearchParams(sort, filter).toString()}`;
}

/** The area page's climb-table filters, in the shared one-row toolbar. No
 * area field: the page already scopes to a crag, and route suggestions are
 * scoped to its subtree for the same reason. `areaPath` is the canonical
 * id + slug URL so filter navigation never bounces through a redirect;
 * `areaId` scopes the route-name suggestions to this subtree. */
export function AreaClimbsToolbar({
  areaId,
  areaPath,
  sort,
  filter,
}: {
  areaId: number;
  areaPath: string;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
}) {
  const router = useRouter();
  const {
    name,
    setName,
    filter: value,
    setFilter: setValue,
    reset,
  } = useFilterFormNavigation({
    initialFilter: {
      disciplines: filter.disciplines,
      boulderRange: filter.boulderRange,
      sportRange: filter.sportRange,
      tradRange: filter.tradRange,
      ratingRange: filter.ratingRange,
      minAscents: filter.minAscents,
      subareaId: filter.subareaId,
    },
    initialName: filter.name ?? "",
    defaultFilter: DEFAULT_AREA_CLIMBS_FILTER,
    sort,
    defaultSort: DEFAULT_AREA_CLIMBS_SORT,
    buildHref: (value, name, _areaName, effectiveSort = sort) =>
      buildClimbsHref(areaPath, effectiveSort, { ...value, name }),
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
          areaId={areaId}
          ariaLabel="Search route name"
          className="w-full sm:w-64"
        />
      }
      sortControl={
        <ClimbListSortControl
          sort={sort}
          onNavigate={(nextSort) =>
            router.replace(buildClimbsHref(areaPath, nextSort, filter), { scroll: false })
          }
        />
      }
      extraFilters={
        <ClimbStatsFields
          ratingRange={value.ratingRange}
          onRatingRangeChange={(ratingRange) => setValue({ ...value, ratingRange })}
          minAscents={value.minAscents}
          onMinAscentsChange={(minAscents) => setValue({ ...value, minAscents })}
        />
      }
    />
  );
}
