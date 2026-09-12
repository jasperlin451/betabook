"use client";

import { ClimbFilterControls } from "@/components/filters/climb-filter-controls";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import type { SearchState } from "@/lib/search";

/** The signed-out half of climb search, on the same toolbar, chips, and reset
 * as the member half — minus the refinements the public catalog cannot answer.
 * Rating and ascent count are member aggregates, so their fields stay out, and
 * the public query orders on name alone, so the sort does too. */
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
      nameSortOnly
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
