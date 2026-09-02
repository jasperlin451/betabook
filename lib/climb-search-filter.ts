import type { SearchClimbsParams, SubtreeClimbsSort } from "@/db/queries";
import { DEFAULT_CLIMB_LIST_SORT, parseClimbListSort } from "@/lib/climb-list-sort";
import {
  DEFAULT_MIN_ASCENTS,
  DEFAULT_RATING_RANGE,
  parseRatingRange,
} from "@/lib/climb-stats-filter";
import {
  DEFAULT_DISCIPLINE_FILTER,
  appendDisciplineFilterParams,
  parseDisciplineFilter,
  toDisciplineGradeFilter,
  type DisciplineFilter,
} from "@/lib/discipline-filter";
import { toArray, type SearchParamsRecord } from "@/lib/search-params";

export const DEFAULT_CLIMB_SEARCH_SORT = DEFAULT_CLIMB_LIST_SORT;
export const parseClimbSearchSort = parseClimbListSort;

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
  const minAscents = Number(toArray(params.minAscents)[0]);

  return {
    ...parseDisciplineFilter(params),
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
    ratingRange: parseRatingRange(params.ratingRange),
    minAscents: Number.isFinite(minAscents) && minAscents >= 0 ? minAscents : DEFAULT_MIN_ASCENTS,
  };
}

/** Serializes both the sort and the discipline/grade/stats filter into one
 * `mode=climb` query string — shared by the sort control, the filter panel,
 * and parseClimbSearchSort/parseClimbSearchFilter, so all three build the
 * exact same param shape. */
export function climbSearchFilterToSearchParams(
  sort: SubtreeClimbsSort,
  filter: ClimbSearchFilter,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "climb");
  params.set("sort", sort);
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
export function toSearchClimbsQueryParams(
  filter: ClimbSearchFilter,
  sort: SubtreeClimbsSort,
): SearchClimbsParams {
  return {
    ...toDisciplineGradeFilter(filter),
    name: filter.name || undefined,
    areaName: filter.areaName || undefined,
    ratingRange: filter.ratingRange,
    minAscents: filter.minAscents,
    sort,
  };
}
