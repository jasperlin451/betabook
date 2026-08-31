"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { RATING_OPTIONS } from "@/lib/climb-stats-filter";
import { formatGrade } from "@/lib/grades";
import { formatDate } from "@/lib/format-date";
import { ASCENT_STYLES, type AscentStyle as AscentStyleType } from "@/lib/sends";
import {
  DEFAULT_USER_SENDS_FILTER,
  MAX_USER_SENDS_LIMIT,
  userSendsFilterToSearchParams,
} from "@/lib/user-sends-filter";
import type { AreaBreadcrumbs, UserSendRow, UserSendsFilter } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { AscentStyle, ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { NavigationPendingRegion } from "@/components/navigation-pending";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { FilterToolbar } from "@/components/filter-toolbar";
import { RouteSearchField } from "@/components/route-search-field";
import { AreaSearchField } from "@/components/area-search-field";
import { LabeledIndexSelect } from "@/components/ui/index-select";
import { SendActionsMenu } from "@/components/send-actions-menu";
import { SendListShell } from "@/components/send-list-shell";
import { SortSelect } from "@/components/ui/sort-select";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";

/** Ascent-style checkboxes for the user sends filter — same structure as
 * DisciplinesFields in send-filter-form.tsx, but not shared there since it's
 * specific to sends, not disciplines/grades. */
function AscentStyleFields({
  value,
  onChange,
}: {
  value: AscentStyleType[];
  onChange: (value: AscentStyleType[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-start gap-3">
      <span className="text-sm font-medium text-foreground">Ascent Style</span>
      <div className="flex flex-wrap items-center justify-start gap-4">
        {ASCENT_STYLES.map((style) => (
          <Checkbox
            key={style}
            isSelected={value.includes(style)}
            onChange={(checked) =>
              onChange(checked ? [...value, style] : value.filter((s) => s !== style))
            }
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {ASCENT_STYLE_LABELS[style]}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
    </div>
  );
}

function MinRatingSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <LabeledIndexSelect label="Min Rating" options={RATING_OPTIONS} index={value} onChange={onChange} />
  );
}

type UserSendListProps = {
  userId: string;
  filter: UserSendsFilter;
  initialSends: UserSendRow[];
  initialHasMore: boolean;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
  /** Whether the user has any sends at all, regardless of the current
   * filter — distinguishes "no sends logged yet" from "none match". */
  hasAnySends: boolean;
  /** The signed-in viewer's own user id, if any — every row here belongs
   * to `userId` (whose profile this is), so the actions menu shows on every
   * row when the viewer is that same user, none otherwise. */
  currentUserId?: string | null;
};

type SortField = "date" | "grade" | "rating";

const SORT_FIELDS: { id: SortField; label: string }[] = [
  { id: "date", label: "Date" },
  { id: "grade", label: "Grade" },
  { id: "rating", label: "Rating" },
];

// Latest/hardest/highest-rated first by default when a field is picked
// fresh — direction only flips via the separate arrow button once a field
// is already active.
const DEFAULT_DIRECTION: Record<SortField, "asc" | "desc"> = {
  date: "desc",
  grade: "desc",
  rating: "desc",
};

/** A user's send-history filters, in the same one-row toolbar the area page
 * uses above its climb table — search, discipline chips, "More filters", and
 * the sort control pushed right — rather than a sidebar card. Debounces
 * every field change into a single navigation, same as every other filter
 * surface.
 *
 * Sort lives here rather than beside the "Sends" heading so that all four
 * ways of narrowing the list sit in one control instead of two.
 *
 * The caller must NOT key this on the filter: keying would remount it (and
 * its <input>s) right when the debounce lands — exactly when the user pauses
 * typing — yanking focus out from under them. External URL changes
 * (back/forward) are instead adopted as values by useFilterFormNavigation,
 * which leaves the mounted inputs alone. */
export function UserSendsFilterToolbar({
  userId,
  filter,
}: {
  userId: string;
  filter: UserSendsFilter;
}) {
  const router = useRouter();
  const {
    name,
    setName,
    areaName,
    setAreaName,
    filter: disciplineFilter,
    setFilter: setDisciplineFilter,
    reset,
  } = useFilterFormNavigation({
    initialFilter: {
      disciplines: filter.disciplines,
      boulderRange: filter.boulderRange,
      sportRange: filter.sportRange,
      tradRange: filter.tradRange,
      ascentStyles: filter.ascentStyles,
      minRating: filter.minRating,
    },
    initialName: filter.name ?? "",
    initialAreaName: filter.areaName ?? "",
    defaultFilter: DEFAULT_USER_SENDS_FILTER,
    // Sort lives in the URL beside the filter; threading it through the
    // hook keeps a non-default sort across filter edits (a filter change
    // used to silently snap the list back to date_desc) while Reset
    // Filters still restores the default.
    sort: filter.sort,
    defaultSort: DEFAULT_USER_SENDS_FILTER.sort,
    buildHref: (disciplineFilter, name, areaName, sort) =>
      `/users/${userId}?${userSendsFilterToSearchParams({ ...disciplineFilter, name, areaName, sort }).toString()}`,
  });

  return (
    <FilterToolbar
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={reset}
      search={
        // One field on the bar: the stats sidebar takes a third of the
        // width, leaving no room for a second. Area scope lives in "More
        // filters" with the rest of the secondary filters.
        <RouteSearchField
          value={name}
          onChange={setName}
          onSelect={(route) => setName(route.name)}
          ariaLabel="Search route name"
          className="w-full sm:w-64"
        />
      }
      sortControl={
        <SortSelect
          // The URL may omit sort entirely; the control still needs a
          // concrete field+direction to show.
          sort={filter.sort ?? "date_desc"}
          fields={SORT_FIELDS}
          defaultField="date"
          defaultDirection={DEFAULT_DIRECTION}
          onNavigate={(nextSort) => {
            const params = userSendsFilterToSearchParams({ ...filter, sort: nextSort });
            router.replace(`/users/${userId}?${params.toString()}`, { scroll: false });
          }}
        />
      }
      extraFilters={
        <>
          {/* Inline label, matching Ascent Style and Min Rating below. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 text-sm font-medium text-foreground">In area</span>
            <AreaSearchField
              value={areaName}
              onChange={setAreaName}
              onSelect={(area) => setAreaName(area.name)}
              ariaLabel="Filter by area"
              placeholder="Anywhere"
              className="w-full sm:w-64"
            />
          </div>
          <AscentStyleFields
            value={disciplineFilter.ascentStyles}
            onChange={(ascentStyles) => setDisciplineFilter({ ...disciplineFilter, ascentStyles })}
          />
          <MinRatingSelect
            value={disciplineFilter.minRating}
            onChange={(minRating) => setDisciplineFilter({ ...disciplineFilter, minRating })}
          />
        </>
      }
    />
  );
}

type UserSendsPageResponse = {
  sends: UserSendRow[];
  hasMore: boolean;
  areaBreadcrumbs: AreaBreadcrumbs;
};

/** A user's send history: server-rendered first page, filters that navigate
 * (so the server can re-filter with real SQL), and a "load more" button
 * that fetches subsequent pages from /api/users/[id]/sends — a user's send
 * count can run into the thousands, so this never holds more in memory or
 * transfers more over the wire than what's actually been scrolled to.
 *
 * The caller keys this component on the filter (see app/users/[id]/page.tsx)
 * so a filter change remounts it with fresh initial state, rather than this
 * component syncing local state to changed props via an effect. A server
 * re-render under the SAME key (a send was deleted/edited via a row's
 * actions menu — the server action refresh()es the route) instead arrives
 * as a new `initialSends` prop identity, which is reconciled into the
 * accumulated pages below. */
export function UserSendList({
  userId,
  filter,
  initialSends,
  initialHasMore,
  initialAreaBreadcrumbs,
  hasAnySends,
  currentUserId,
}: UserSendListProps) {
  const [sends, setSends] = useState(initialSends);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // --- Post-mutation reconciliation of accumulated pages -------------------
  //
  // Same adoption idea as useFilterFormNavigation's URL handling: track the
  // last-adopted prop identity, and when the incoming first page changes
  // while the key (sort/filter) didn't, the server data changed underneath
  // the accumulated rows. With only page 1 loaded, adopting the fresh props
  // IS the reconcile. With extra pages loaded, re-fetch the loaded range
  // rather than dropping back to page 1: dropping would collapse the list
  // right as the user acts on a row further down (scroll jump, lost place),
  // while re-fetching swaps corrected rows in without moving the layout.
  // `staleTailLength` holds how many beyond-page-1 rows need re-fetching;
  // non-null means a reconcile fetch is due/in flight.
  const [prevInitialSends, setPrevInitialSends] = useState(initialSends);
  const [staleTailLength, setStaleTailLength] = useState<number | null>(null);
  // A length delta alone can't distinguish "extra pages loaded" from "page 1
  // itself shrank" (deleting a send from a full single page leaves
  // sends.length > initialSends.length too) — only an actual load-more sets
  // this, so the shrink case adopts the fresh page immediately instead of
  // ghosting the deleted row through a pointless tail re-fetch.
  const [loadedBeyondFirstPage, setLoadedBeyondFirstPage] = useState(false);
  if (initialSends !== prevInitialSends) {
    setPrevInitialSends(initialSends);
    const tailLength = sends.length - initialSends.length;
    if (loadedBeyondFirstPage && tailLength > 0 && tailLength <= MAX_USER_SENDS_LIMIT) {
      setStaleTailLength(tailLength);
    } else {
      // Either only page 1 is loaded (adopting the fresh props IS the
      // reconcile), or the tail exceeds what the route's clamped `limit`
      // can restore in one request (200+ rows = 20+ load-more clicks) —
      // requesting it anyway would silently truncate the range, so for that
      // rare case drop back to the fresh first page instead. Correctness
      // (a deleted send must never keep ghosting) beats keeping the scroll
      // position there.
      setStaleTailLength(null);
      setLoadedBeyondFirstPage(false);
      setSends(initialSends);
      setHasMore(initialHasMore);
      setAreaBreadcrumbs((prev) => ({ ...prev, ...initialAreaBreadcrumbs }));
    }
  }

  useEffect(() => {
    if (staleTailLength === null) return;
    let cancelled = false;
    (async () => {
      try {
        const params = userSendsFilterToSearchParams(filter);
        params.set("offset", String(initialSends.length));
        params.set("limit", String(staleTailLength));
        const res = await fetch(`/api/users/${userId}/sends?${params.toString()}`);
        if (!res.ok) throw new Error(`Reloading sends failed: ${res.status}`);
        const data: UserSendsPageResponse = await res.json();
        if (cancelled) return;
        // Atomic swap of the whole loaded range — the stale rows stay
        // visible until this lands, so the layout never collapses.
        setSends([...initialSends, ...data.sends]);
        setHasMore(data.hasMore);
        setAreaBreadcrumbs((prev) => ({
          ...prev,
          ...initialAreaBreadcrumbs,
          ...data.areaBreadcrumbs,
        }));
      } catch {
        if (cancelled) return;
        // Correctness over continuity: the stale tail must not outlive the
        // reconcile (a deleted send would keep ghosting), so fall back to
        // just the fresh first page and let the inline error explain the
        // shrink — the "load more" button doubles as the retry.
        setSends(initialSends);
        setHasMore(initialHasMore);
        setLoadedBeyondFirstPage(false);
        setAreaBreadcrumbs((prev) => ({ ...prev, ...initialAreaBreadcrumbs }));
        setLoadMoreFailed(true);
      } finally {
        if (!cancelled) setStaleTailLength(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staleTailLength, initialSends, initialHasMore, initialAreaBreadcrumbs, filter, userId]);

  const reconciling = staleTailLength !== null;

  // Post-commit mirror of the latest adopted first page, so an async
  // load-more completion can tell whether a mutation refresh superseded the
  // ordering it was fetched against.
  const latestInitialSends = useRef(initialSends);
  useEffect(() => {
    latestInitialSends.current = initialSends;
  }, [initialSends]);

  async function handleLoadMore() {
    const baseInitialSends = latestInitialSends.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const params = userSendsFilterToSearchParams(filter);
      params.set("offset", String(sends.length));
      const res = await fetch(`/api/users/${userId}/sends?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading more sends failed: ${res.status}`);
      const data: UserSendsPageResponse = await res.json();
      // If a mutation refresh landed while this was in flight, this page was
      // fetched against a superseded ordering — drop it (the reconcile above
      // re-fetches the loaded range itself) rather than appending stale rows.
      if (latestInitialSends.current !== baseInitialSends) return;
      setSends((prev) => [...prev, ...data.sends]);
      setLoadedBeyondFirstPage(true);
      setHasMore(data.hasMore);
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
    } catch {
      // Network failure or a non-2xx response — keep what's loaded, surface
      // an inline error, and leave the button as the retry affordance.
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!hasAnySends) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          message="No sends yet."
          cta={
            currentUserId === userId ? (
              <AppLink href="/account/import" className="text-sm">
                Import your sends
              </AppLink>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dimmed while the toolbar's debounced navigation is re-fetching
       * these results (see NavigationPendingProvider in the page). */}
      <NavigationPendingRegion>
        <SendListShell
          sends={sends}
          emptyState={<EmptyState message="No sends match these filters." />}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          // Also disabled while a post-mutation reconcile is re-fetching the
          // loaded range — a load-more against the superseded ordering would
          // be dropped anyway (see handleLoadMore).
          loadingMore={loadingMore || reconciling}
          loadMoreError={
            loadMoreFailed && (
              <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
            )
          }
          renderRow={(send) => (
            <ListRow
              title={send.climbName}
              href={`/climbs/${send.climbId}`}
              subtitle={
                <AreaBreadcrumb
                  areaId={send.areaId}
                  areaName={send.areaName}
                  ancestors={areaBreadcrumbs[send.areaId] ?? []}
                />
              }
              trailing={
                <div className="flex flex-col items-end gap-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Grade>
                      {formatGrade(send.climbType, send.climbGrade)}
                      {send.suggestedGrade != null && send.suggestedGrade !== send.climbGrade && (
                        <span className="font-normal text-muted">
                          {" "}
                          ({formatGrade(send.climbType, send.suggestedGrade)})
                        </span>
                      )}
                      {send.gradeFeel === "high" && (
                        <ArrowUp className="size-3.5 text-muted" aria-label="High end of the grade" />
                      )}
                      {send.gradeFeel === "low" && (
                        <ArrowDown className="size-3.5 text-muted" aria-label="Low end of the grade" />
                      )}
                    </Grade>
                    <RatingStars rating={send.rating} />
                  </div>
                  <AscentStyle type={send.ascentStyle} />
                  <div className="text-xs text-muted">{formatDate(send.dateSent)}</div>
                </div>
              }
              actions={
                currentUserId === userId && (
                  <SendActionsMenu
                    climb={{
                      id: send.climbId,
                      areaId: send.areaId,
                      type: send.climbType,
                      grade: send.climbGrade,
                    }}
                    send={send}
                  />
                )
              }
              comment={send.comment}
            />
          )}
        />
      </NavigationPendingRegion>
    </div>
  );
}
