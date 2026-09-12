"use client";

import { ClimbFilterControls } from "@/components/filters/climb-filter-controls";
import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import type { SearchState } from "@/lib/search";

/** The signed-out half of climb search, on the same toolbar, chips, and reset
 * as the member half — minus the refinements the public catalog cannot answer.
 * Rating and ascent count are member aggregates, so their fields and their
 * sort options stay out and name order is the only ordering offered. */
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
      sortControl={
        <OptionSelect
          ariaLabel="Sort results"
          value={state.sort === "name_desc" ? "name_desc" : "name_asc"}
          onChange={(sort) => onChange({ ...state, sort })}
          options={[
            { value: "name_asc", label: "Name A–Z" },
            { value: "name_desc", label: "Name Z–A" },
          ]}
          className={FIELD_WIDTH_CLASS.medium}
        />
      }
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
