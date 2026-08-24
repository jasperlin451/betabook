import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { parseDisciplines, toArray, toRange, type SearchParamsRecord } from "@/lib/search-params";
import type { UserSendsFilter, UserSendsSort } from "@/db/queries";

const USER_SENDS_SORTS: UserSendsSort[] = [
  "date_desc",
  "date_asc",
  "grade_desc",
  "grade_asc",
  "rating_desc",
  "rating_asc",
];

// No disciplines checked means "don't filter on discipline or grade at
// all" — not "match nothing". Checking one activates that filter (and
// reveals its grade-range dropdowns when the panel is expanded).
export const DEFAULT_USER_SENDS_FILTER: UserSendsFilter = {
  disciplines: [],
  boulderRange: [0, BOULDER_HUECO.length - 1],
  sportRange: [0, ROPE_YDS.length - 1],
  tradRange: [0, ROPE_YDS.length - 1],
  sort: "date_desc",
};

/** No `discipline` params means no disciplines are checked — an unfiltered
 * view, not "match nothing" (see DEFAULT_USER_SENDS_FILTER). */
export function parseUserSendsFilter(params: SearchParamsRecord): UserSendsFilter {
  const disciplines = parseDisciplines(params);

  const rawSort = toArray(params.sort)[0];
  const sort = USER_SENDS_SORTS.includes(rawSort as UserSendsSort)
    ? (rawSort as UserSendsSort)
    : DEFAULT_USER_SENDS_FILTER.sort;

  return {
    disciplines,
    boulderRange: toRange(params.boulderRange, DEFAULT_USER_SENDS_FILTER.boulderRange),
    sportRange: toRange(params.sportRange, DEFAULT_USER_SENDS_FILTER.sportRange),
    tradRange: toRange(params.tradRange, DEFAULT_USER_SENDS_FILTER.tradRange),
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
    sort,
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
  params.set("sort", filter.sort ?? "date_desc");
  return params;
}
