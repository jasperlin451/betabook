"use client";

import { useState } from "react";
import { ClimbList } from "@/components/climb-list";
import { NavigationPendingRegion } from "@/components/navigation-pending";
import { areaClimbsFilterToSearchParams, type AreaClimbsFilter } from "@/lib/area-climbs-filter";
import type { AreaBreadcrumbs, ClimbSendStats, ClimbWithAreaName, SubtreeClimbsSort } from "@/db/queries";

type AreaClimbsSectionProps = {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
  initialClimbs: ClimbWithAreaName[];
  initialHasNextPage: boolean;
  initialSendStats: Record<number, ClimbSendStats>;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
  sentClimbIds?: Set<number>;
  emptyMessage?: string;
};

/** Owns the area page's accumulated "load more" list state and the fetch
 * that backs it — separate from ClimbList itself since ClimbList is also
 * used by climb search, which doesn't have any of this. Search, filters,
 * and sort live in AreaClimbsToolbar above it; this just renders whatever
 * the URL's sort+filter selected, page by page.
 *
 * The caller keys this component on `{ sort, filter }` (see
 * app/areas/[id]/page.tsx) so a sort/filter change remounts it with fresh
 * initial state, rather than this component syncing accumulated state to
 * changed props via an effect. */
export function AreaClimbsSection({
  areaId,
  sort,
  filter,
  initialClimbs,
  initialHasNextPage,
  initialSendStats,
  initialAreaBreadcrumbs,
  sentClimbIds,
  emptyMessage,
}: AreaClimbsSectionProps) {
  const [climbs, setClimbs] = useState(initialClimbs);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [sendStats, setSendStats] = useState(initialSendStats);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadedSentClimbIds, setLoadedSentClimbIds] = useState(sentClimbIds);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // Climbs are fetched PAGE_SIZE at a time (see db/queries/shared.ts), so the
  // next page to request is however many full pages are already loaded —
  // not climbs.length, which would be wrong after any dedup/filter change.
  const [loadedPages, setLoadedPages] = useState(1);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const params = areaClimbsFilterToSearchParams(sort, filter);
      params.set("page", String(loadedPages + 1));
      const res = await fetch(`/api/areas/${areaId}/climbs?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading more climbs failed: ${res.status}`);
      const data: {
        climbs: ClimbWithAreaName[];
        hasNextPage: boolean;
        sendStats: Record<number, ClimbSendStats>;
        areaBreadcrumbs: AreaBreadcrumbs;
        sentClimbIds?: number[];
      } = await res.json();
      setClimbs((prev) => [...prev, ...data.climbs]);
      setHasNextPage(data.hasNextPage);
      setSendStats((prev) => ({ ...prev, ...data.sendStats }));
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
      if (data.sentClimbIds) {
        setLoadedSentClimbIds(
          (prev) => new Set([...(prev ?? []), ...data.sentClimbIds!]),
        );
      }
      setLoadedPages((prev) => prev + 1);
    } catch {
      // Network failure or a non-2xx response — keep what's loaded, surface
      // an inline error, and leave the button as the retry affordance.
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      {/* Dimmed while the toolbar's debounced navigation is re-fetching
       * these results (see NavigationPendingProvider in the page). */}
      <NavigationPendingRegion>
        <ClimbList
          climbs={climbs}
          emptyMessage={emptyMessage}
          sendStats={sendStats}
          areaBreadcrumbs={areaBreadcrumbs}
          sentClimbIds={loadedSentClimbIds}
          pagination={{
            hasNextPage,
            loadingMore,
            onLoadMore: handleLoadMore,
            error: loadMoreFailed && (
              <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
            ),
          }}
        />
      </NavigationPendingRegion>
    </section>
  );
}
