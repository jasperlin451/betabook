"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, TextField } from "@heroui/react";
import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";
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
  const [name, setName] = useState(defaultFilter.name ?? "");
  const [areaName, setAreaName] = useState(defaultFilter.areaName ?? "");
  const [filter, setFilter] = useState<ClimbSearchFilter>(defaultFilter);

  // Auto-search: debounce every field change (including the initial render)
  // into a single navigation instead of requiring an explicit submit. Sort
  // is preserved as-is — it's owned by ClimbSearchSortControl, not this form.
  useDebouncedReplace(
    `/?${climbSearchFilterToSearchParams(sort, { ...filter, name, areaName }).toString()}`,
  );

  function clearFilters() {
    setName("");
    setAreaName("");
    setFilter(DEFAULT_CLIMB_SEARCH_FILTER);
  }

  return (
    <DisciplineFilterForm
      value={filter}
      onChange={setFilter}
      onReset={clearFilters}
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
