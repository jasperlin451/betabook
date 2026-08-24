"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ListBox, Select } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ClimbList } from "@/components/climb-list";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";
import { useSortToggle } from "@/hooks/use-sort-toggle";
import {
  areaClimbsFilterToSearchParams,
  DEFAULT_BOULDER_RANGE,
  DEFAULT_SPORT_RANGE,
  DEFAULT_TRAD_RANGE,
  type AreaClimbsFilter,
} from "@/lib/area-climbs-filter";
import type { AreaBreadcrumbs, Climb, ClimbSendStats, SubtreeClimbsSort } from "@/db/queries";

/** Shared by the sort control, the filter panel, and "load more" — each
 * needs the other's current state to build a URL/request that doesn't
 * silently drop it. */
function buildClimbsHref(areaId: number, sort: SubtreeClimbsSort, filter: AreaClimbsFilter): string {
  return `/areas/${areaId}?${areaClimbsFilterToSearchParams(sort, filter).toString()}`;
}

type SortField = "name" | "grade" | "rating" | "ascents";

const SORT_FIELDS: SortField[] = ["name", "grade", "rating", "ascents"];

// Alphabetical/hardest/highest-rated/most-sent first by default when a
// field is picked fresh — direction only flips via the separate arrow
// button once a field is already active.
const DEFAULT_DIRECTION: Record<SortField, "asc" | "desc"> = {
  name: "asc",
  grade: "desc",
  rating: "desc",
  ascents: "desc",
};

type AreaClimbsSectionProps = {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
  initialClimbs: Climb[];
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
        climbs: Climb[];
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

  const { field, direction, handleFieldChange, toggleDirection } = useSortToggle({
    sort,
    fields: SORT_FIELDS,
    defaultField: "ascents",
    defaultDirection: DEFAULT_DIRECTION,
    navigate: (nextSort) =>
      // Preserves the active filter (see buildClimbsHref) — remounting this
      // component (keyed on sort+filter by the caller) naturally resets back
      // to page 1's accumulated state.
      router.replace(buildClimbsHref(areaId, nextSort, filter), { scroll: false }),
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Climbs</h2>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Sort by"
            selectedKey={field}
            onSelectionChange={(key) => handleFieldChange(key as SortField)}
          >
            <Select.Trigger className="w-32">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="name">Name</ListBox.Item>
                <ListBox.Item id="grade">Grade</ListBox.Item>
                <ListBox.Item id="rating">Rating</ListBox.Item>
                <ListBox.Item id="ascents">Ascents</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            aria-label={direction === "asc" ? "Sort ascending" : "Sort descending"}
            onPress={toggleDirection}
          >
            {direction === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>
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
  const [name, setName] = useState(filter.name ?? "");
  const [disciplineFilter, setDisciplineFilter] = useState<AreaClimbsFilter>({
    disciplines: filter.disciplines,
    boulderRange: filter.boulderRange,
    sportRange: filter.sportRange,
    tradRange: filter.tradRange,
  });

  useDebouncedReplace(buildClimbsHref(areaId, sort, { ...disciplineFilter, name }));

  function handleReset() {
    setName("");
    setDisciplineFilter({
      disciplines: [],
      boulderRange: DEFAULT_BOULDER_RANGE,
      sportRange: DEFAULT_SPORT_RANGE,
      tradRange: DEFAULT_TRAD_RANGE,
    });
  }

  return (
    <DisciplineFilterForm
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={handleReset}
      showNameSearch
      name={name}
      onNameChange={setName}
    />
  );
}
