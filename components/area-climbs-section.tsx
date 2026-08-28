"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClimbList } from "@/components/climb-list";
import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  areaClimbsFilterToSearchParams,
  DEFAULT_AREA_CLIMBS_SORT,
  DEFAULT_BOULDER_RANGE,
  DEFAULT_SPORT_RANGE,
  DEFAULT_TRAD_RANGE,
  type AreaClimbsFilter,
} from "@/lib/area-climbs-filter";
import { DEFAULT_MIN_ASCENTS, DEFAULT_RATING_RANGE } from "@/lib/climb-stats-filter";
import type { AreaBreadcrumbs, ClimbSendStats, ClimbWithAreaName, SubtreeClimbsSort } from "@/db/queries";

/** Shared by the sort control, the filter panel, and "load more" — each
 * needs the other's current state to build a URL/request that doesn't
 * silently drop it. */
function buildClimbsHref(areaId: number, sort: SubtreeClimbsSort, filter: AreaClimbsFilter): string {
  return `/areas/${areaId}?${areaClimbsFilterToSearchParams(sort, filter).toString()}`;
}

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

/** Owns the climbs sort control (inline with the "Climbs" heading), the
 * accumulated "load more" list state, and the fetch that backs it, for the
 * area page — separate from ClimbList itself since ClimbList is also used
 * by climb search, which doesn't have any of this. Same field-dropdown +
 * shared direction-arrow-button sort UX, and the same "load more" pattern
 * (server-rendered first page, client-fetched rest), as the user send list.
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
  const router = useRouter();
  const [climbs, setClimbs] = useState(initialClimbs);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [sendStats, setSendStats] = useState(initialSendStats);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);
  // Climbs are fetched PAGE_SIZE at a time (see db/queries/shared.ts), so the
  // next page to request is however many full pages are already loaded —
  // not climbs.length, which would be wrong after any dedup/filter change.
  const [loadedPages, setLoadedPages] = useState(1);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const params = areaClimbsFilterToSearchParams(sort, filter);
      params.set("page", String(loadedPages + 1));
      const res = await fetch(`/api/areas/${areaId}/climbs?${params.toString()}`);
      const data: {
        climbs: ClimbWithAreaName[];
        hasNextPage: boolean;
        sendStats: Record<number, ClimbSendStats>;
        areaBreadcrumbs: AreaBreadcrumbs;
      } = await res.json();
      setClimbs((prev) => [...prev, ...data.climbs]);
      setHasNextPage(data.hasNextPage);
      setSendStats((prev) => ({ ...prev, ...data.sendStats }));
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
      setLoadedPages((prev) => prev + 1);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Climbs</h2>
        <ClimbListSortControl
          sort={sort}
          onNavigate={(nextSort) =>
            // Preserves the active filter (see buildClimbsHref) — remounting
            // this component (keyed on sort+filter by the caller) naturally
            // resets back to page 1's accumulated state.
            router.replace(buildClimbsHref(areaId, nextSort, filter), { scroll: false })
          }
        />
      </div>
      <ClimbList
        climbs={climbs}
        emptyMessage={emptyMessage}
        sendStats={sendStats}
        areaBreadcrumbs={areaBreadcrumbs}
        sentClimbIds={sentClimbIds}
        pagination={{ hasNextPage, loadingMore, onLoadMore: handleLoadMore }}
      />
    </section>
  );
}

/** The name/discipline/grade filter for the area page's climb list — same
 * `DisciplineFilterForm` and debounced-navigation pattern as the climb
 * search page's `ClimbSearchForm` (area search omitted, since this is
 * already scoped to one area) and `UserSendsFilterPanel`. Not keyed on
 * `filter` by the caller, for the same reason documented on
 * `UserSendsFilterPanel` — this component owns the state that drives
 * navigation, so a change is always self-inflicted, never an external
 * resync. */
export function AreaClimbsFilterPanel({
  areaId,
  sort,
  filter,
}: {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
}) {
  const { name, setName, filter: disciplineFilter, setFilter: setDisciplineFilter, reset } =
    useFilterFormNavigation({
      initialFilter: {
        disciplines: filter.disciplines,
        boulderRange: filter.boulderRange,
        sportRange: filter.sportRange,
        tradRange: filter.tradRange,
        ratingRange: filter.ratingRange,
        minAscents: filter.minAscents,
      },
      initialName: filter.name ?? "",
      defaultFilter: {
        disciplines: [],
        boulderRange: DEFAULT_BOULDER_RANGE,
        sportRange: DEFAULT_SPORT_RANGE,
        tradRange: DEFAULT_TRAD_RANGE,
        ratingRange: DEFAULT_RATING_RANGE,
        minAscents: DEFAULT_MIN_ASCENTS,
      },
      sort,
      defaultSort: DEFAULT_AREA_CLIMBS_SORT,
      buildHref: (disciplineFilter, name, _areaName, effectiveSort = sort) =>
        buildClimbsHref(areaId, effectiveSort, { ...disciplineFilter, name }),
    });

  return (
    <DisciplineFilterForm
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={reset}
      showNameSearch
      name={name}
      onNameChange={setName}
      extraOptions={
        <ClimbStatsFields
          ratingRange={disciplineFilter.ratingRange}
          onRatingRangeChange={(ratingRange) =>
            setDisciplineFilter({ ...disciplineFilter, ratingRange })
          }
          minAscents={disciplineFilter.minAscents}
          onMinAscentsChange={(minAscents) =>
            setDisciplineFilter({ ...disciplineFilter, minAscents })
          }
        />
      }
    />
  );
}
