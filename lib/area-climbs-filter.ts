import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import type { Discipline, DisciplineGradeFilter, SubtreeClimbsSort } from "@/db/queries";

const SUBTREE_CLIMBS_SORTS: SubtreeClimbsSort[] = [
  "name_asc",
  "name_desc",
  "grade_asc",
  "grade_desc",
  "rating_asc",
  "rating_desc",
  "ascents_asc",
  "ascents_desc",
];

export const DEFAULT_AREA_CLIMBS_SORT: SubtreeClimbsSort = "ascents_desc";

export const DEFAULT_BOULDER_RANGE: [number, number] = [0, BOULDER_HUECO.length - 1];
export const DEFAULT_SPORT_RANGE: [number, number] = [0, ROPE_YDS.length - 1];
export const DEFAULT_TRAD_RANGE: [number, number] = [0, ROPE_YDS.length - 1];

/** Ranges are always present (unlike DisciplineGradeFilter's, which are
 * optional) — a range slider needs a default position to render even for an
 * unchecked discipline. Only when this is handed to the query layer
 * (toSubtreeQueryFilter) does an unchecked discipline's range get dropped. */
export type AreaClimbsFilter = {
  name?: string;
  disciplines: Discipline[];
  boulderRange: [number, number];
  sportRange: [number, number];
  tradRange: [number, number];
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toRange(
  value: string | string[] | undefined,
  fallback: [number, number],
): [number, number] {
  const values = toArray(value).map(Number).filter(Number.isFinite);
  if (values.length < 2) return fallback;
  return [Math.min(...values), Math.max(...values)];
}

export function parseAreaClimbsSort(params: SearchParamsRecord): SubtreeClimbsSort {
  const rawSort = toArray(params.sort)[0];
  return SUBTREE_CLIMBS_SORTS.includes(rawSort as SubtreeClimbsSort)
    ? (rawSort as SubtreeClimbsSort)
    : DEFAULT_AREA_CLIMBS_SORT;
}

export function parseAreaClimbsFilter(params: SearchParamsRecord): AreaClimbsFilter {
  const disciplines = toArray(params.discipline).filter(
    (d): d is Discipline => d === "boulder" || d === "sport" || d === "trad",
  );

  return {
    name: toArray(params.name)[0],
    disciplines,
    boulderRange: toRange(params.boulderRange, DEFAULT_BOULDER_RANGE),
    sportRange: toRange(params.sportRange, DEFAULT_SPORT_RANGE),
    tradRange: toRange(params.tradRange, DEFAULT_TRAD_RANGE),
  };
}

/** getSubtreeClimbs's filter param — same "only pass a range for a checked
 * discipline" convention as the climb search page, so an unchecked
 * discipline's (possibly stale, from before it was unchecked) range can't
 * smuggle in a filter. */
export function toSubtreeQueryFilter(filter: AreaClimbsFilter): DisciplineGradeFilter & { name?: string } {
  return {
    name: filter.name || undefined,
    disciplines: filter.disciplines,
    boulderRange: filter.disciplines.includes("boulder") ? filter.boulderRange : undefined,
    sportRange: filter.disciplines.includes("sport") ? filter.sportRange : undefined,
    tradRange: filter.disciplines.includes("trad") ? filter.tradRange : undefined,
  };
}

/** Serializes both the sort and the discipline/grade filter into one query
 * string — shared by the sort control, the filter panel, and the "load
 * more" fetch, so all three build the exact same param shape
 * parseAreaClimbsSort/parseAreaClimbsFilter expect back. */
export function areaClimbsFilterToSearchParams(
  sort: SubtreeClimbsSort,
  filter: AreaClimbsFilter,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("sort", sort);
  if (filter.name) params.set("name", filter.name);
  filter.disciplines.forEach((discipline) => params.append("discipline", discipline));
  if (filter.disciplines.includes("boulder")) {
    params.append("boulderRange", String(filter.boulderRange[0]));
    params.append("boulderRange", String(filter.boulderRange[1]));
  }
  if (filter.disciplines.includes("sport")) {
    params.append("sportRange", String(filter.sportRange[0]));
    params.append("sportRange", String(filter.sportRange[1]));
  }
  if (filter.disciplines.includes("trad")) {
    params.append("tradRange", String(filter.tradRange[0]));
    params.append("tradRange", String(filter.tradRange[1]));
  }
  return params;
}
