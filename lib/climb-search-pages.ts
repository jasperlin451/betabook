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

/** A refresh can re-fetch this many already-visible rows in one bounded
 * request. Beyond it the shared reconciler falls back to the fresh first
 * page instead of retaining a large, potentially stale client tail. */
export const MAX_CLIMB_RECONCILE_ITEMS = 200;

/** Per-row metadata that has to move in lockstep with a reconciled climb
 * list. `coveredClimbIds` makes sent state authoritative only for the rows a
 * response actually answered, so an un-send is adopted without discarding
 * answers for other loaded pages. */
export type ClimbListMeta = {
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Set<number>;
  coveredClimbIds: Set<number>;
};

/** Combines page-accumulated sent ids with the latest server-rendered first
 * page. The refreshed set is also the signed-in sentinel: when it is absent,
 * row actions must disappear rather than leaking stale authenticated state.
 *
 * `refreshedClimbIds` is what keeps this from being a plain union. Both sets
 * are answers about specific climbs, not global truth: the refreshed one
 * covers exactly the climbs on the re-rendered first page, so for those it is
 * authoritative in BOTH directions — a climb missing from it is unsent, and a
 * union would resurrect it from `accumulated` forever. Ids outside that page
 * still come from `accumulated`, which is the only answer anyone has for
 * climbs a refresh never looked at. */
export function mergeRefreshedSentClimbIds(
  refreshed: Iterable<number> | undefined,
  accumulated: Iterable<number> | undefined,
  refreshedClimbIds: Iterable<number>,
): Set<number> | undefined {
  if (refreshed === undefined) return undefined;
  const answeredByRefresh = new Set(refreshedClimbIds);
  const merged = new Set(refreshed);
  for (const id of accumulated ?? []) {
    if (!answeredByRefresh.has(id)) merged.add(id);
  }
  return merged;
}

export function createClimbListMeta({
  climbs,
  sendStats,
  areaBreadcrumbs,
  sentClimbIds,
}: {
  climbs: readonly Pick<ClimbWithAreaName, "id">[];
  sendStats: Record<number, ClimbSendStats>;
  areaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Iterable<number>;
}): ClimbListMeta {
  return {
    sendStats,
    areaBreadcrumbs,
    sentClimbIds: sentClimbIds === undefined ? undefined : new Set(sentClimbIds),
    coveredClimbIds: new Set(climbs.map((climb) => climb.id)),
  };
}

/** Merge page metadata in arrival order. Each incoming page is authoritative
 * for the climbs it covers, while data for other loaded pages is retained. */
export function mergeClimbListMeta(
  current: ClimbListMeta,
  ...incoming: ClimbListMeta[]
): ClimbListMeta {
  const sendStats = { ...current.sendStats };
  const areaBreadcrumbs = { ...current.areaBreadcrumbs };
  const coveredClimbIds = new Set(current.coveredClimbIds);
  let sentClimbIds =
    current.sentClimbIds === undefined ? undefined : new Set(current.sentClimbIds);

  for (const next of incoming) {
    Object.assign(sendStats, next.sendStats);
    Object.assign(areaBreadcrumbs, next.areaBreadcrumbs);
    sentClimbIds = mergeRefreshedSentClimbIds(
      next.sentClimbIds,
      sentClimbIds,
      next.coveredClimbIds,
    );
    for (const id of next.coveredClimbIds) coveredClimbIds.add(id);
  }

  return { sendStats, areaBreadcrumbs, sentClimbIds, coveredClimbIds };
}

export async function fetchClimbSearchPage(
  sort: SubtreeClimbsSort,
  filter: ClimbSearchFilter,
  page: number,
  {
    count = false,
    signal,
    offset,
    limit,
  }: {
    count?: boolean;
    signal?: AbortSignal;
    offset?: number;
    limit?: number;
  } = {},
): Promise<ClimbSearchPage> {
  const params = climbSearchFilterToSearchParams(sort, filter);
  if (offset !== undefined) {
    params.set("offset", String(offset));
    if (limit !== undefined) params.set("limit", String(limit));
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
