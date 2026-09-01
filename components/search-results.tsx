"use client";

import { useMemo, useState } from "react";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { type ClimbSearchFilter } from "@/lib/climb-search-filter";
import {
  createClimbListMeta,
  fetchClimbSearchPage,
  MAX_CLIMB_RECONCILE_ITEMS,
  mergeClimbListMeta,
} from "@/lib/climb-search-pages";
import { useReconciledPagedList } from "@/hooks/use-reconciled-paged-list";
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
  /** Sent ids for the initial page. Later pages carry their own subset. */
  sentClimbIds?: Set<number>;
}) {
  const initialMeta = useMemo(
    () =>
      createClimbListMeta({
        climbs: initialClimbs,
        sendStats: initialSendStats,
        areaBreadcrumbs: initialAreaBreadcrumbs,
        sentClimbIds,
      }),
    [initialClimbs, initialSendStats, initialAreaBreadcrumbs, sentClimbIds],
  );
  const {
    items: climbs,
    hasMore: hasNextPage,
    meta: { sendStats, areaBreadcrumbs, sentClimbIds: visibleSentClimbIds },
    loadingMore,
    loadMoreFailed,
    loadMore,
  } = useReconciledPagedList({
    initialItems: initialClimbs,
    initialHasMore: initialHasNextPage,
    initialMeta,
    maxReconcileItems: MAX_CLIMB_RECONCILE_ITEMS,
    itemKey: (climb) => climb.id,
    mergeMeta: mergeClimbListMeta,
    fetchPage: async (offset, limit) => {
      const next = await fetchClimbSearchPage(sort, filter, 1, { offset, limit });
      return {
        items: next.climbs,
        hasMore: next.hasNextPage,
        meta: createClimbListMeta(next),
      };
    },
  });

  return (
    <ClimbList
      climbs={climbs}
      sendStats={sendStats}
      areaBreadcrumbs={areaBreadcrumbs}
      sentClimbIds={visibleSentClimbIds}
      emptyMessage="No climbs match your search."
      pagination={{
        hasNextPage,
        loadingMore,
        onLoadMore: loadMore,
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
