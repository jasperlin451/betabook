"use client";

import { PUBLIC_CLIMB_SORT_FIELDS } from "@/components/climb-list-sort-control";
import { ClimbFilterControls } from "@/components/filters/climb-filter-controls";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import type { SearchState } from "@/lib/search";

/** The signed-out half of climb search, on the same toolbar, chips, and reset
 * as the member half — minus the refinements the public catalog cannot answer.
 * Rating and ascent count are member aggregates, so neither their fields nor
 * their sort options appear; name and grade, which every public row already
 * prints, do. */
export function PublicSearchFilters({
  state,
  onChange,
}: {
  state: SearchState;
  onChange: (state: SearchState) => void;
}) {
  return (
    <ClimbFilterControls
      value={state}
      onChange={(next) => onChange({ ...state, ...next })}
      showAreaLookup
      showMinAscents={false}
      showRatingFilters={false}
      sortFields={PUBLIC_CLIMB_SORT_FIELDS}
      activeFilters={
        state.query
          ? [
              {
                id: "query",
                label: `Search: ${state.query}`,
                onRemove: () => onChange({ ...state, query: "" }),
              },
            ]
          : []
      }
      onReset={() =>
        onChange({
          ...state,
          query: "",
          filter: DEFAULT_CLIMB_FILTER,
          area: null,
          sort: "name_asc",
        })
      }
    />
  );
}
