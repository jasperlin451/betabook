import type { AreaWithAncestorPath, ClimberRow, ClimbWithAreaName } from "@/db/queries";
import type { AreaSelection } from "@/lib/area-selection";
import type { ClimbListPage } from "@/lib/climb-list-pages";
import { DEFAULT_CLIMB_LIST_SORT, parseClimbListSort } from "@/lib/climb-list-sort";
import {
  climbFilterToSearchParams,
  DEFAULT_CLIMB_FILTER,
  parseClimbFilter,
} from "@/lib/filters/climb-filter";
import type { ClimbFilterState } from "@/lib/filters/climb-filter-state";
import type { ClimbType } from "@/lib/grades";
import type { PublicClimbsPage } from "@/lib/public-catalog";
import { areaHref, climbHref } from "@/lib/slug";
import { toArray, type UrlParamsRecord } from "@/lib/url-params";

export type SearchKind = "climb" | "area" | "climber";
export type SearchCategory = "all" | SearchKind;
export type SearchStatus = "idle" | "loading" | "ready" | "error" | "locked";
export type SearchResult = {
  id: string;
  name: string;
  detail: string;
  disabledReason?: string;
  image?: string | null;
} & (
  | {
      kind: "climb";
      discipline: ClimbType;
      grade: number | null;
      stats?: { avgRating: number | null; sendCount: number };
    }
  | { kind: "area" | "climber" }
);
export type SearchSection = {
  kind: SearchKind;
  items: SearchResult[];
  status: SearchStatus;
  hasMore?: boolean;
};
export type ClimbSelectionContext = {
  ancestors: { id: number; name: string }[];
  sendCount: number;
  sent: boolean;
};
export type AppSearchResult = SearchResult & {
  href: string;
  climb?: ClimbWithAreaName;
  context?: ClimbSelectionContext;
  climber?: ClimberRow;
};
export type SearchPage = { items: AppSearchResult[]; hasMore: boolean; nextPage: number };
export type SearchState = ClimbFilterState & {
  query: string;
  category: SearchCategory;
};
export type SearchSnapshot = { kind: SearchKind; page: SearchPage; status: SearchStatus }[];
export type SearchFetcher = (
  state: SearchState,
  kind: SearchKind,
  page: number,
  signal: AbortSignal,
) => Promise<SearchPage>;
export const SEARCH_KINDS: SearchKind[] = ["climb", "area", "climber"];
export const EMPTY_SEARCH: SearchState = {
  query: "",
  category: "all",
  filter: DEFAULT_CLIMB_FILTER,
  sort: DEFAULT_CLIMB_LIST_SORT,
  area: null,
};

export function parseSearchState(
  params: UrlParamsRecord,
  area: AreaSelection | null = null,
): SearchState {
  const raw = toArray(params.mode)[0];
  const category = raw === "climb" || raw === "area" || raw === "climber" ? raw : "all";
  return {
    query: toArray(params.name)[0] ?? "",
    category,
    filter: parseClimbFilter(params),
    sort: parseClimbListSort(params),
    area,
  };
}

/** Used by quick-search expansion, full results, and browser history. */
export function searchHref(state: SearchState): string {
  const params = climbFilterToSearchParams(state.sort, {
    ...state.filter,
    name: state.query,
  });
  params.set("mode", state.category);
  return `/?${params}`;
}

export function climbSearchItems(page: ClimbListPage): AppSearchResult[] {
  return page.climbs.map((climb) => {
    const ancestors = page.areaBreadcrumbs[climb.areaId] ?? [];
    return {
      id: `climb-${climb.id}`,
      kind: "climb",
      name: climb.name,
      detail: [...ancestors.map((a) => a.name), climb.areaName].join(" / "),
      discipline: climb.type,
      grade: climb.grade,
      stats: {
        avgRating: page.sendStats[climb.id]?.avgRating ?? null,
        sendCount: page.sendStats[climb.id]?.sendCount ?? 0,
      },
      href: climbHref(climb.id, climb.name),
      climb,
      context: {
        ancestors,
        sendCount: page.sendStats[climb.id]?.sendCount ?? 0,
        sent: page.sentClimbIds?.includes(climb.id) ?? false,
      },
    };
  });
}
export function areaSearchItems(
  areas: Pick<AreaWithAncestorPath, "id" | "name" | "ancestorPath">[],
): AppSearchResult[] {
  return areas.map((area) => ({
    id: `area-${area.id}`,
    kind: "area",
    name: area.name,
    detail: area.ancestorPath?.split(" > ").join(" / ") ?? "Area",
    href: areaHref(area.id, area.name),
  }));
}
export function climberSearchItems(climbers: ClimberRow[]): AppSearchResult[] {
  return climbers.map((climber) => ({
    id: `climber-${climber.id}`,
    kind: "climber",
    name: climber.name,
    detail: "Climber",
    image: climber.image,
    href: `/users/${encodeURIComponent(climber.id)}`,
    climber,
  }));
}

export function publicClimbSearchItems(page: PublicClimbsPage): AppSearchResult[] {
  return page.climbs.map((climb) => ({
    id: `climb-${climb.id}`,
    kind: "climb",
    name: climb.name,
    grade: climb.grade,
    discipline: climb.type,
    detail: [
      ...(page.areaBreadcrumbs[climb.areaId] ?? []).map((area) => area.name),
      climb.areaName,
    ].join(" / "),
    href: climbHref(climb.id, climb.name),
  }));
}
