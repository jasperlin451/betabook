"use client";

import { useMemo } from "react";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { type ClimbSearchFilter } from "@/lib/climb-search-filter";
import {
  createClimbListMeta,
  fetchClimbSearchPage,
  mergeClimbListMeta,
} from "@/lib/climb-search-pages";
import { usePagedList } from "@/hooks/use-paged-list";
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
        sendStats: initialSendStats,
        areaBreadcrumbs: initialAreaBreadcrumbs,
        sentClimbIds,
      }),
    [initialSendStats, initialAreaBreadcrumbs, sentClimbIds],
  );
  const {
    items: climbs,
    hasMore: hasNextPage,
    meta: { sendStats, areaBreadcrumbs, sentClimbIds: visibleSentClimbIds },
    loadingMore,
    loadMoreFailed,
    loadMore,
  } = usePagedList({
    initialItems: initialClimbs,
    initialHasMore: initialHasNextPage,
    initialMeta,
    itemKey: (climb) => climb.id,
    mergeMeta: mergeClimbListMeta,
    fetchPage: async (offset) => {
      const next = await fetchClimbSearchPage(sort, filter, 1, { offset });
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
        failed: loadMoreFailed,
      }}
    />
  );
}

/** The area-mode counterpart of ClimbSearchResults, backed by
 * /api/search/areas — the same `usePagedList` state, with the breadcrumb
 * map as its per-page meta. Keyed on `name` by the caller for the same
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
  const {
    items: areas,
    hasMore: hasNextPage,
    meta: areaBreadcrumbs,
    loadingMore,
    loadMoreFailed,
    loadMore,
  } = usePagedList({
    initialItems: initialAreas,
    initialHasMore: initialHasNextPage,
    initialMeta: initialAreaBreadcrumbs,
    itemKey: (area) => area.id,
    mergeMeta: (current, incoming) => ({ ...current, ...incoming }),
    fetchPage: async (_offset, page) => {
      const params = new URLSearchParams({ name, page: String(page) });
      const res = await fetch(`/api/search/areas?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading more results failed: ${res.status}`);
      const data: {
        areas: AreaWithAncestorPath[];
        hasNextPage: boolean;
        areaBreadcrumbs: AreaBreadcrumbs;
      } = await res.json();
      return { items: data.areas, hasMore: data.hasNextPage, meta: data.areaBreadcrumbs };
    },
  });

  return (
    <AreaList
      areas={areas}
      variant="search"
      areaBreadcrumbs={areaBreadcrumbs}
      emptyMessage={emptyMessage}
      pagination={{
        hasNextPage,
        loadingMore,
        onLoadMore: loadMore,
        failed: loadMoreFailed,
      }}
    />
  );
}
