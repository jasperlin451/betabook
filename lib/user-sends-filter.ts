import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import type { Discipline, UserSendsFilter } from "@/db/queries";

// No disciplines checked means "don't filter on discipline or grade at
// all" — not "match nothing". Checking one activates that filter (and
// reveals its grade-range dropdowns when the panel is expanded).
export const DEFAULT_USER_SENDS_FILTER: UserSendsFilter = {
  disciplines: [],
  boulderRange: [0, BOULDER_HUECO.length - 1],
  sportRange: [0, ROPE_YDS.length - 1],
  tradRange: [0, ROPE_YDS.length - 1],
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

/** No `discipline` params means no disciplines are checked — an unfiltered
 * view, not "match nothing" (see DEFAULT_USER_SENDS_FILTER). */
export function parseUserSendsFilter(params: SearchParamsRecord): UserSendsFilter {
  const disciplines = toArray(params.discipline).filter(
    (d): d is Discipline => d === "boulder" || d === "sport" || d === "trad",
  );

  return {
    disciplines,
    boulderRange: toRange(params.boulderRange, DEFAULT_USER_SENDS_FILTER.boulderRange),
    sportRange: toRange(params.sportRange, DEFAULT_USER_SENDS_FILTER.sportRange),
    tradRange: toRange(params.tradRange, DEFAULT_USER_SENDS_FILTER.tradRange),
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
  };
}

export function userSendsFilterToSearchParams(filter: UserSendsFilter): URLSearchParams {
  const params = new URLSearchParams();
  filter.disciplines.forEach((discipline) => params.append("discipline", discipline));
  params.append("boulderRange", String(filter.boulderRange[0]));
  params.append("boulderRange", String(filter.boulderRange[1]));
  params.append("sportRange", String(filter.sportRange[0]));
  params.append("sportRange", String(filter.sportRange[1]));
  params.append("tradRange", String(filter.tradRange[0]));
  params.append("tradRange", String(filter.tradRange[1]));
  if (filter.name) params.set("name", filter.name);
  if (filter.areaName) params.set("areaName", filter.areaName);
  return params;
}
