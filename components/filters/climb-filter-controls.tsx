"use client";
import { Button } from "@heroui/react";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { ClimbFilters } from "@/components/filters/climb-filters";
import { ClimbStatsFields } from "@/components/filters/climb-stats-filter-fields";
import { AreaLookup } from "@/components/search/area-lookup";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import { withClimbFilterArea } from "@/lib/filters/climb-filter-state";
import type { ClimbFilterState } from "@/lib/filters/climb-filter-state";

/** App refinements retain all existing grade, rating, ascent-count, and sort options. */
export function ClimbFilterControls({
  value,
  onChange,
  initialAreaQuery,
  areaFetcher,
  showAreaLookup = false,
}: {
  showAreaLookup?: boolean;
  areaFetcher?: ComponentProps<typeof AreaLookup>["fetcher"];
  value: ClimbFilterState;
  onChange: (value: ClimbFilterState) => void;
  initialAreaQuery?: string;
}) {
  return (
    <ClimbFilters
      value={{
        ...value.filter,
        area: value.area,
        sort: value.sort,
        minRating: value.filter.ratingRange[0],
      }}
      onChange={(refinements) => {
        const next = {
          ...value,
          sort: refinements.sort,
          filter: {
            ...value.filter,
            disciplines: refinements.disciplines,
            boulderRange: refinements.boulderRange,
            sportRange: refinements.sportRange,
            tradRange: refinements.tradRange,
          },
        };
        onChange(
          refinements.area === value.area ? next : withClimbFilterArea(next, refinements.area),
        );
      }}
      onReset={() =>
        onChange({ ...value, filter: DEFAULT_CLIMB_FILTER, sort: "name_asc", area: null })
      }
      areaControl={
        !value.area ? (
          <>
            {value.filter.areaName && (
              <Button
                variant="secondary"
                size="sm"
                className="max-w-full self-start"
                aria-label={`Clear area name ${value.filter.areaName}`}
                onPress={() => onChange(withClimbFilterArea(value, null))}
              >
                <span className="truncate">Area name: {value.filter.areaName}</span>
                <X className="size-3.5 shrink-0" aria-hidden />
              </Button>
            )}
            {showAreaLookup && (
              <AreaLookup
                fetcher={areaFetcher}
                value={null}
                defaultQuery={initialAreaQuery}
                onChange={(area) => onChange(withClimbFilterArea(value, area))}
              />
            )}
          </>
        ) : undefined
      }
      sortControl={
        <div className="sm:ml-auto">
          <ClimbListSortControl
            sort={value.sort}
            onNavigate={(sort) => onChange({ ...value, sort })}
          />
        </div>
      }
      ratingControl={
        <ClimbStatsFields
          ratingRange={value.filter.ratingRange}
          minAscents={value.filter.minAscents}
          onRatingRangeChange={(ratingRange) =>
            onChange({ ...value, filter: { ...value.filter, ratingRange } })
          }
          onMinAscentsChange={(minAscents) =>
            onChange({ ...value, filter: { ...value.filter, minAscents } })
          }
        />
      }
    />
  );
}
