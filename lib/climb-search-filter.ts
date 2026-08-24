import { DEFAULT_MIN_ASCENTS, DEFAULT_RATING_RANGE } from "@/lib/climb-stats-filter";
import {
  DEFAULT_DISCIPLINE_FILTER,
  appendDisciplineFilterParams,
  parseDisciplineFilter,
  toDisciplineGradeFilter,
  type DisciplineFilter,
} from "@/lib/discipline-filter";
import { toArray, type SearchParamsRecord } from "@/lib/search-params";
import type { SearchClimbsParams } from "@/db/queries";

export type ClimbSearchFilter = DisciplineFilter & {
  name?: string;
  areaName?: string;
  ratingRange: [number, number];
  minAscents: number;
};

export const DEFAULT_CLIMB_SEARCH_FILTER: ClimbSearchFilter = {
  ...DEFAULT_DISCIPLINE_FILTER,
  ratingRange: DEFAULT_RATING_RANGE,
  minAscents: DEFAULT_MIN_ASCENTS,
};

export function parseClimbSearchFilter(params: SearchParamsRecord): ClimbSearchFilter {
  const [minRating, maxRating] = toArray(params.ratingRange).map(Number);
  const minAscents = Number(toArray(params.minAscents)[0]);

  return {
    ...parseDisciplineFilter(params),
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
    ratingRange:
      Number.isFinite(minRating) && Number.isFinite(maxRating)
        ? [minRating, maxRating]
        : DEFAULT_RATING_RANGE,
    minAscents: Number.isFinite(minAscents) && minAscents >= 0 ? minAscents : DEFAULT_MIN_ASCENTS,
  };
}

/** Builds the `mode=climb` query string the homepage's climb search reads
 * back via `parseClimbSearchFilter` — same shape as `areaClimbsFilterToSearchParams`. */
export function climbSearchFilterToSearchParams(filter: ClimbSearchFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "climb");
  if (filter.name) params.set("name", filter.name);
  if (filter.areaName) params.set("areaName", filter.areaName);
  appendDisciplineFilterParams(params, filter);
  params.append("ratingRange", String(filter.ratingRange[0]));
  params.append("ratingRange", String(filter.ratingRange[1]));
  if (filter.minAscents) params.set("minAscents", String(filter.minAscents));
  return params;
}

/** searchClimbs's query param — same "drop a range for an unchecked
 * discipline" convention as toSubtreeQueryFilter. */
export function toSearchClimbsQueryParams(filter: ClimbSearchFilter): SearchClimbsParams {
  return {
    ...toDisciplineGradeFilter(filter),
    name: filter.name || undefined,
    areaName: filter.areaName || undefined,
    ratingRange: filter.ratingRange,
    minAscents: filter.minAscents,
  };
}
