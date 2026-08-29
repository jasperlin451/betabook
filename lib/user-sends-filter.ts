import {
  DEFAULT_DISCIPLINE_FILTER,
  appendDisciplineFilterParams,
  parseDisciplineFilter,
} from "@/lib/discipline-filter";
import { parseAscentStyles, toArray, type SearchParamsRecord } from "@/lib/search-params";
import type { UserSendsFilter, UserSendsSort } from "@/db/queries";

const USER_SENDS_SORTS: UserSendsSort[] = [
  "date_desc",
  "date_asc",
  "grade_desc",
  "grade_asc",
  "rating_desc",
  "rating_asc",
];

/** Upper bound on /api/users/[id]/sends's `limit` param, shared by the
 * route (which clamps to it), UserSendList's post-mutation reconcile
 * (which won't request beyond it — see the reconcile comment there for the
 * fallback when more rows than this are loaded), and ExportSendsButton's
 * paged CSV export (which requests exactly this per page). Sized for "one
 * bounded request", not "arbitrary bulk fetch". */
export const MAX_USER_SENDS_LIMIT = 200;

// No disciplines checked means "don't filter on discipline or grade at
// all" — not "match nothing". Checking one activates that filter (and
// reveals its grade-range dropdowns when the panel is expanded). Same
// convention for ascentStyles (empty = unfiltered) and minRating (0 = "Any").
export const DEFAULT_USER_SENDS_FILTER: UserSendsFilter = {
  ...DEFAULT_DISCIPLINE_FILTER,
  sort: "date_desc",
  ascentStyles: [],
  minRating: 0,
};

/** No `discipline` params means no disciplines are checked — an unfiltered
 * view, not "match nothing" (see DEFAULT_USER_SENDS_FILTER). */
export function parseUserSendsFilter(params: SearchParamsRecord): UserSendsFilter {
  const rawSort = toArray(params.sort)[0];
  const sort = USER_SENDS_SORTS.includes(rawSort as UserSendsSort)
    ? (rawSort as UserSendsSort)
    : DEFAULT_USER_SENDS_FILTER.sort;

  const minRating = Number(toArray(params.minRating)[0]);

  return {
    ...parseDisciplineFilter(params),
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
    sort,
    ascentStyles: parseAscentStyles(params),
    minRating:
      Number.isFinite(minRating) && minRating >= 0 && minRating <= 5
        ? minRating
        : DEFAULT_USER_SENDS_FILTER.minRating,
  };
}

export function userSendsFilterToSearchParams(filter: UserSendsFilter): URLSearchParams {
  const params = new URLSearchParams();
  appendDisciplineFilterParams(params, filter);
  if (filter.name) params.set("name", filter.name);
  if (filter.areaName) params.set("areaName", filter.areaName);
  params.set("sort", filter.sort ?? "date_desc");
  filter.ascentStyles.forEach((style) => params.append("ascentStyle", style));
  if (filter.minRating) params.set("minRating", String(filter.minRating));
  return params;
}
