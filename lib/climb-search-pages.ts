import {
  climbSearchFilterToSearchParams,
  type ClimbSearchFilter,
} from "@/lib/climb-search-filter";
import type {
  AreaBreadcrumbs,
  ClimbSendStats,
  ClimbWithAreaName,
  SubtreeClimbsSort,
} from "@/db/queries";

/** One page of /api/search/climbs in its full (non-suggestion) shape — what
 * the home search and the climb picker both page through. `count` only comes
 * back for a request that asked for it. */
export type ClimbSearchPage = {
  climbs: ClimbWithAreaName[];
  hasNextPage: boolean;
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  /** Sent ids for this page only; omitted for signed-out viewers. */
  sentClimbIds?: number[];
  count?: number;
};

/** The accumulated slice of a paged search — what a "load more" list holds. */
export type ClimbSearchPages = {
  climbs: ClimbWithAreaName[];
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Set<number>;
  hasNextPage: boolean;
  /** Pages loaded so far, so the next request knows what to ask for. */
  loadedPages: number;
};

/** Per-row metadata accumulated as the viewer loads more climbs. A fresh
 * server snapshot replaces this object along with the accumulated rows. */
export type ClimbListMeta = {
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Set<number>;
};

export function createClimbListMeta({
  sendStats,
  areaBreadcrumbs,
  sentClimbIds,
}: {
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Iterable<number>;
}): ClimbListMeta {
  return {
    sendStats,
    areaBreadcrumbs,
    sentClimbIds: sentClimbIds === undefined ? undefined : new Set(sentClimbIds),
  };
}

/** Add one newly loaded page's metadata to the visible list. */
export function mergeClimbListMeta(current: ClimbListMeta, incoming: ClimbListMeta): ClimbListMeta {
  return {
    sendStats: { ...current.sendStats, ...incoming.sendStats },
    areaBreadcrumbs: { ...current.areaBreadcrumbs, ...incoming.areaBreadcrumbs },
    sentClimbIds:
      incoming.sentClimbIds === undefined
        ? undefined
        : new Set([...(current.sentClimbIds ?? []), ...incoming.sentClimbIds]),
  };
}

export async function fetchClimbSearchPage(
  sort: SubtreeClimbsSort,
  filter: ClimbSearchFilter,
  page: number,
  {
    count = false,
    signal,
    offset,
  }: {
    count?: boolean;
    signal?: AbortSignal;
    offset?: number;
  } = {},
): Promise<ClimbSearchPage> {
  const params = climbSearchFilterToSearchParams(sort, filter);
  if (offset !== undefined) {
    params.set("offset", String(offset));
  } else if (page > 1) {
    params.set("page", String(page));
  }
  // The total is the same for every page of a search, so only the page that
  // needs it pays for the COUNT (see the route).
  if (count) params.set("count", "1");

  const res = await fetch(`/api/search/climbs?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Climb search failed: ${res.status}`);
  return res.json();
}

export function firstPage(page: ClimbSearchPage): ClimbSearchPages {
  return {
    climbs: page.climbs,
    sendStats: page.sendStats,
    areaBreadcrumbs: page.areaBreadcrumbs,
    sentClimbIds: page.sentClimbIds ? new Set(page.sentClimbIds) : undefined,
    hasNextPage: page.hasNextPage,
    loadedPages: 1,
  };
}

/** Appends a freshly fetched page. The lookup maps are merged rather than
 * replaced — they're keyed by climb/area id and only cover their own page. */
export function appendPage(pages: ClimbSearchPages, next: ClimbSearchPage): ClimbSearchPages {
  return {
    climbs: [...pages.climbs, ...next.climbs],
    sendStats: { ...pages.sendStats, ...next.sendStats },
    areaBreadcrumbs: { ...pages.areaBreadcrumbs, ...next.areaBreadcrumbs },
    sentClimbIds:
      pages.sentClimbIds || next.sentClimbIds
        ? new Set([...(pages.sentClimbIds ?? []), ...(next.sentClimbIds ?? [])])
        : undefined,
    hasNextPage: next.hasNextPage,
    loadedPages: pages.loadedPages + 1,
  };
}
