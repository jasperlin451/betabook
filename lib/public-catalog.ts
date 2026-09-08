import type { AreaBreadcrumbs } from "@/db/queries/areas";
import {
  parseAreaId,
  parseOffset,
  parsePage,
  parseSuggestionLimit,
  offsetReachesPaginationLimit,
} from "@/lib/url-params";

export type PublicArea = { id: number; name: string; parentId: number | null };
export type PublicAreaResult = PublicArea & { ancestorPath: string | null };
export type PublicClimb = { id: number; name: string; areaId: number; areaName: string };
export type PublicClimbsPage = {
  climbs: PublicClimb[];
  areaBreadcrumbs: AreaBreadcrumbs;
  hasNextPage: boolean;
};
export type PublicCatalogOptions = {
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
export function hasProtectedCatalogParams(params: URLSearchParams): boolean {
  return (
    [...params.keys()].some((key) => !PUBLIC_PARAMS.has(key)) ||
    (params.has("sort") && !["name_asc", "name_desc"].includes(params.get("sort") ?? ""))
  );
}

export function publicCatalogOptions(params: URLSearchParams): PublicCatalogOptions {
  const pageSize = parseSuggestionLimit(params) ?? 25;
  const page = parsePage(params, pageSize);
  return {
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
