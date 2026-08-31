"use client";

import { useState } from "react";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { type ClimbSearchFilter } from "@/lib/climb-search-filter";
import { appendPage, fetchClimbSearchPage } from "@/lib/climb-search-pages";
import type { ClimbSearchPages } from "@/lib/climb-search-pages";
import type {
  AreaBreadcrumbs,
  AreaWithAncestorPath,
  ClimbSendStats,
  ClimbWithAreaName,
  SubtreeClimbsSort,
} from "@/db/queries";

/** Owns the accumulated "load more" state for home-page climb search and the
 * fetch that backs it (/api/search/climbs) — same pattern as
 * AreaClimbsSection: server-rendered first page, client-fetched rest.
 *
 * The caller keys this component on `{ sort, filter }` (see app/page.tsx) so
 * a sort/filter change remounts it with fresh initial state, rather than
 * this component syncing accumulated state to changed props via an effect. */
export function ClimbSearchResults({
  sort,
  filter,
  initialClimbs,
  initialHasNextPage,
  initialSendStats,
  initialAreaBreadcrumbs,
  sentClimbIds,
}: {
  sort: SubtreeClimbsSort;
  filter: ClimbSearchFilter;
  initialClimbs: ClimbWithAreaName[];
  initialHasNextPage: boolean;
  initialSendStats: Record<number, ClimbSendStats>;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
  /** Every climb id the signed-in viewer has ever sent — covers climbs on
   * later pages too, so it never needs re-fetching on "load more". */
  sentClimbIds?: Set<number>;
}) {
  // Results are fetched SEARCH_PAGE_SIZE at a time (see db/queries/climbs.ts),
  // so the next page to request is however many full pages are already loaded.
  const [pages, setPages] = useState<ClimbSearchPages>({
    climbs: initialClimbs,
    sendStats: initialSendStats,
    areaBreadcrumbs: initialAreaBreadcrumbs,
    hasNextPage: initialHasNextPage,
    loadedPages: 1,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const next = await fetchClimbSearchPage(sort, filter, pages.loadedPages + 1);
      setPages((prev) => appendPage(prev, next));
    } catch {
      // Network failure or a non-2xx response — keep what's loaded, surface
      // an inline error, and leave the button as the retry affordance.
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <ClimbList
      climbs={pages.climbs}
      sendStats={pages.sendStats}
      areaBreadcrumbs={pages.areaBreadcrumbs}
      sentClimbIds={sentClimbIds}
      emptyMessage="No climbs match your search."
      pagination={{
        hasNextPage: pages.hasNextPage,
        loadingMore,
        onLoadMore: handleLoadMore,
        error: loadMoreFailed && (
          <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
        ),
      }}
    />
  );
}

/** The area-mode counterpart of ClimbSearchResults, backed by
 * /api/search/areas. Keyed on `name` by the caller for the same
 * remount-on-change reasoning. */
export function AreaSearchResults({
  name,
  initialAreas,
  initialHasNextPage,
  initialAreaBreadcrumbs,
  emptyMessage,
}: {
  name: string;
  initialAreas: AreaWithAncestorPath[];
  initialHasNextPage: boolean;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
  emptyMessage: string;
}) {
  const [areas, setAreas] = useState(initialAreas);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [loadedPages, setLoadedPages] = useState(1);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const params = new URLSearchParams({ name, page: String(loadedPages + 1) });
      const res = await fetch(`/api/search/areas?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading more results failed: ${res.status}`);
      const data: {
        areas: AreaWithAncestorPath[];
        hasNextPage: boolean;
        areaBreadcrumbs: AreaBreadcrumbs;
      } = await res.json();
      setAreas((prev) => [...prev, ...data.areas]);
      setHasNextPage(data.hasNextPage);
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
      setLoadedPages((prev) => prev + 1);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AreaList
      areas={areas}
      variant="search"
      areaBreadcrumbs={areaBreadcrumbs}
      emptyMessage={emptyMessage}
      pagination={{
        hasNextPage,
        loadingMore,
        onLoadMore: handleLoadMore,
        error: loadMoreFailed && (
          <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
        ),
      }}
    />
  );
}
