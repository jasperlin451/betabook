import type { AreaBreadcrumbs } from "@/db/queries/areas";
import {
  parseDisciplineFilter,
  toDisciplineGradeFilter,
  type DisciplineGradeFilter,
} from "@/lib/filters/discipline-filter";
import type { ClimbType } from "@/lib/grades";
import {
  parseAreaId,
  parseOffset,
  parsePage,
  parseSuggestionLimit,
  offsetReachesPaginationLimit,
  searchParamsToRecord,
} from "@/lib/url-params";

export type PublicArea = { id: number; name: string; parentId: number | null };
export type PublicAreaDetails = PublicArea & { description: string | null };
export type PublicAreaResult = PublicAreaDetails & { ancestorPath: string | null };
export type PublicClimb = {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  type: ClimbType;
  grade: number | null;
  description: string | null;
};
export type PublicClimbsPage = {
  climbs: PublicClimb[];
  areaBreadcrumbs: AreaBreadcrumbs;
  hasNextPage: boolean;
};
export type PublicCatalogOptions = DisciplineGradeFilter & {
  name: string;
  areaId?: number;
  areaName?: string;
  descending: boolean;
  offset: number | null;
  pageSize: number;
};

const PUBLIC_PARAMS = new Set([
  "name",
  "areaId",
  "areaName",
  "subarea",
  "page",
  "offset",
  "limit",
  "sort",
]);

/** Climb lists also narrow on discipline and grade — the two climb facts the
 * public projection already returns, so filtering on them discloses nothing a
 * reader could not read off the rows. An area list has neither column, so the
 * same params there would be dropped in silence and stay protected. */
const PUBLIC_CLIMB_PARAMS = new Set(["discipline", "boulderRange", "sportRange", "tradRange"]);

export function hasProtectedCatalogParams(
  params: URLSearchParams,
  { climbFilters = false }: { climbFilters?: boolean } = {},
): boolean {
  return (
    [...params.keys()].some(
      (key) => !PUBLIC_PARAMS.has(key) && !(climbFilters && PUBLIC_CLIMB_PARAMS.has(key)),
    ) ||
    (params.has("sort") && !["name_asc", "name_desc"].includes(params.get("sort") ?? ""))
  );
}

export function publicCatalogOptions(params: URLSearchParams): PublicCatalogOptions {
  const pageSize = parseSuggestionLimit(params) ?? 25;
  const page = parsePage(params, pageSize);
  return {
    ...toDisciplineGradeFilter(parseDisciplineFilter(searchParamsToRecord(params))),
    name: params.get("name") ?? "",
    areaId: parseAreaId(params.get("areaId") ?? undefined),
    areaName: params.get("areaName") ?? undefined,
    descending: params.get("sort") === "name_desc",
    offset: params.has("offset")
      ? parseOffset(params)
      : page === null
        ? null
        : (page - 1) * pageSize,
    pageSize,
  };
}

export function publicHasNextPage(length: number, options: PublicCatalogOptions): boolean {
  return (
    length > options.pageSize &&
    options.offset !== null &&
    !offsetReachesPaginationLimit(options.offset, options.pageSize)
  );
}
