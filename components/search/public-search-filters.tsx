"use client";

import { Button } from "@heroui/react";

import { AreaLookup } from "@/components/search/area-lookup";
import { withClimbFilterArea } from "@/lib/filters/climb-filter-state";
import type { SearchState } from "@/lib/search";

export function PublicSearchFilters({
  state,
  onChange,
}: {
  state: SearchState;
  onChange: (state: SearchState) => void;
}) {
  const scope = state.area?.name ?? state.filter.areaName;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {scope ? (
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Clear area ${state.area ? "" : "name "}${scope}`}
          onPress={() => onChange(withClimbFilterArea(state, null))}
        >
          {scope} ×
        </Button>
      ) : (
        <AreaLookup value={null} onChange={(area) => onChange(withClimbFilterArea(state, area))} />
      )}
      <Button
        variant="outline"
        size="sm"
        aria-label="Reverse name order"
        onPress={() =>
          onChange({ ...state, sort: state.sort === "name_desc" ? "name_asc" : "name_desc" })
        }
      >
        {state.sort === "name_desc" ? "Z–A" : "A–Z"}
      </Button>
    </div>
  );
}
