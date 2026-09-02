import type { AreaWithAncestorPath, ClimbWithAreaName } from "@/db/queries";
import { TYPEAHEAD_LIMIT } from "@/hooks/use-typeahead";

export type RouteSuggestion = {
  id: number;
  name: string;
  type: ClimbWithAreaName["type"];
  /** Null for an ungraded route — `formatGrade` renders the app-wide "—". */
  grade: number | null;
  areaName: string;
};

export type AreaSuggestion = {
  id: number;
  name: string;
  /** Root-first, " / "-joined — the same reading as `AreaBreadcrumb`, so
   * "where is this" looks identical in a popover and in a result row. Null
   * for a root area, which has no ancestors to place it under. */
  ancestorPath: string | null;
};

/** `searchAreas` already returns `ancestorPath` root-first; this only swaps
 * its " > " for the " / " every rendered breadcrumb uses, so a suggestion row
 * and a result row look like the same thing. */
export function toBreadcrumbPath(ancestorPath: string | null): string | null {
  if (!ancestorPath) return null;
  return ancestorPath.split(" > ").join(" / ") || null;
}

/** Suggestion lookups hit the same endpoints the result lists page through,
 * with `limit` set — which caps the rows *and* drops the send-stat and
 * breadcrumb joins those lists need and a popover never reads (see the route
 * handlers). Failures propagate; `useTypeahead` is what swallows them. */
export async function fetchRouteSuggestions(
  query: string,
  signal: AbortSignal,
  { areaId, limit = TYPEAHEAD_LIMIT }: { areaId?: number; limit?: number } = {},
): Promise<RouteSuggestion[]> {
  const params = new URLSearchParams({ name: query, limit: String(limit) });
  // Inside an area, suggestions come from that area's subtree — the routes
  // the surrounding page is already about — rather than the whole database.
  const path = areaId != null ? `/api/areas/${areaId}/climbs` : "/api/search/climbs";

  const res = await fetch(`${path}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Route suggestions failed: ${res.status}`);
  const data: { climbs: ClimbWithAreaName[] } = await res.json();

  return data.climbs.map((climb) => ({
    id: climb.id,
    name: climb.name,
    type: climb.type,
    grade: climb.grade,
    areaName: climb.areaName,
  }));
}

export async function fetchAreaSuggestions(
  query: string,
  signal: AbortSignal,
  { limit = TYPEAHEAD_LIMIT }: { limit?: number } = {},
): Promise<AreaSuggestion[]> {
  const params = new URLSearchParams({ name: query, limit: String(limit) });

  const res = await fetch(`/api/search/areas?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Area suggestions failed: ${res.status}`);
  const data: { areas: AreaWithAncestorPath[] } = await res.json();

  return data.areas.map((area) => ({
    id: area.id,
    name: area.name,
    ancestorPath: toBreadcrumbPath(area.ancestorPath),
  }));
}
