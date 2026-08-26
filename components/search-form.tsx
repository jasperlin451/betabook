"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, TextField } from "@heroui/react";
import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  climbSearchFilterToSearchParams,
  DEFAULT_CLIMB_SEARCH_FILTER,
  DEFAULT_CLIMB_SEARCH_SORT,
  type ClimbSearchFilter,
} from "@/lib/climb-search-filter";
import type { SubtreeClimbsSort } from "@/db/queries";

export function AreaSearchForm({ defaultName = "" }: { defaultName?: string }) {
  const [name, setName] = useState(defaultName);

  // Auto-search: debounce every field change (including the initial render)
  // into a single navigation, same as the climb search form.
  const params = new URLSearchParams();
  params.set("mode", "area");
  if (name) params.set("name", name);
  useDebouncedReplace(`/?${params.toString()}`);

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6">
      <TextField value={name} onChange={setName}>
        <Label>Area Name</Label>
        <Input placeholder="Search area..." className="bg-surface" />
      </TextField>
    </div>
  );
}

type ClimbSearchFormProps = {
  defaultFilter?: ClimbSearchFilter;
  sort?: SubtreeClimbsSort;
};

export function ClimbSearchForm({
  defaultFilter = DEFAULT_CLIMB_SEARCH_FILTER,
  sort = DEFAULT_CLIMB_SEARCH_SORT,
}: ClimbSearchFormProps) {
  // Auto-search: debounce every field change (including the initial render)
  // into a single navigation instead of requiring an explicit submit. Sort
  // is preserved as-is — it's owned by ClimbSearchSortControl, not this form.
  const { name, setName, areaName, setAreaName, filter, setFilter, reset } =
    useFilterFormNavigation({
      initialFilter: defaultFilter,
      initialName: defaultFilter.name ?? "",
      initialAreaName: defaultFilter.areaName ?? "",
      defaultFilter: DEFAULT_CLIMB_SEARCH_FILTER,
      buildHref: (filter, name, areaName) =>
        `/?${climbSearchFilterToSearchParams(sort, { ...filter, name, areaName }).toString()}`,
    });

  return (
    <DisciplineFilterForm
      value={filter}
      onChange={setFilter}
      onReset={reset}
      name={name}
      onNameChange={setName}
      areaName={areaName}
      onAreaNameChange={setAreaName}
      extraOptions={
        <ClimbStatsFields
          ratingRange={filter.ratingRange}
          onRatingRangeChange={(ratingRange) => setFilter({ ...filter, ratingRange })}
          minAscents={filter.minAscents}
          onMinAscentsChange={(minAscents) => setFilter({ ...filter, minAscents })}
        />
      }
    />
  );
}

/** The "Results" heading's sort control for climb search — same
 * <ClimbListSortControl> as the area page, navigating to `/?...` instead of
 * `/areas/[id]?...`. Preserves the active filter (see `filter` param) so a
 * sort change doesn't silently drop it. */
export function ClimbSearchSortControl({
  sort,
  filter,
}: {
  sort: SubtreeClimbsSort;
  filter: ClimbSearchFilter;
}) {
  const router = useRouter();

  return (
    <ClimbListSortControl
      sort={sort}
      onNavigate={(nextSort) =>
        router.replace(`/?${climbSearchFilterToSearchParams(nextSort, filter).toString()}`, {
          scroll: false,
        })
      }
    />
  );
}
