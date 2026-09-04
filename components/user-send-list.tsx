"use client";

import { Checkbox } from "@heroui/react";
import { useRouter } from "next/navigation";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { AreaSearchField } from "@/components/area-search-field";
import { AscentStyle, ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { FilterToolbar } from "@/components/filter-toolbar";
import { LogEntryButton } from "@/components/journal";
import { NavigationPendingRegion } from "@/components/navigation-pending";
import { RouteSearchField } from "@/components/route-search-field";
import { SendActionsMenu } from "@/components/send-actions-menu";
import { SendGradeCell } from "@/components/send-grade-cell";
import { SendListShell } from "@/components/send-list-shell";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { LabeledIndexSelect } from "@/components/ui/index-select";
import { ListRow } from "@/components/ui/list-row";
import { SortSelect } from "@/components/ui/sort-select";
import type { AreaBreadcrumbs, UserSendRow, UserSendsFilter } from "@/db/queries";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import { usePagedList } from "@/hooks/use-paged-list";
import { RATING_OPTIONS } from "@/lib/climb-stats-filter";
import { formatDate } from "@/lib/format-date";
import { ASCENT_STYLES, type AscentStyle as AscentStyleType } from "@/lib/sends";
import { climbHref } from "@/lib/slug";
import { DEFAULT_USER_SENDS_FILTER, userSendsFilterToSearchParams } from "@/lib/user-sends-filter";

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
      <span className="text-sm font-medium text-foreground">Ascent style</span>
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

function MinRatingSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <LabeledIndexSelect
      label="Min rating"
      options={RATING_OPTIONS}
      index={value}
      onChange={onChange}
    />
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
 * as a new `initialSends` prop identity, which resets the accumulated list
 * to the server's fresh first page. */
export function UserSendList({
  userId,
  filter,
  initialSends,
  initialHasMore,
  initialAreaBreadcrumbs,
  hasAnySends,
  currentUserId,
}: UserSendListProps) {
  const {
    items: sends,
    hasMore,
    meta: areaBreadcrumbs,
    loadingMore,
    loadMoreFailed,
    loadMore,
  } = usePagedList({
    initialItems: initialSends,
    initialHasMore,
    initialMeta: initialAreaBreadcrumbs,
    itemKey: (send) => send.id,
    mergeMeta: (current, incoming) => ({ ...current, ...incoming }),
    fetchPage: async (offset) => {
      const params = userSendsFilterToSearchParams(filter);
      params.set("offset", String(offset));
      const res = await fetch(`/api/users/${userId}/sends?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading sends failed: ${res.status}`);
      const data: UserSendsPageResponse = await res.json();
      return {
        items: data.sends,
        hasMore: data.hasMore,
        meta: data.areaBreadcrumbs,
      };
    },
  });

  if (!hasAnySends) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          message="No sends yet."
          cta={
            currentUserId === userId ? (
              <div className="flex flex-col items-center gap-3">
                <LogEntryButton />
                <AppLink href="/account/import" className="text-sm">
                  Import your sends
                </AppLink>
              </div>
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
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          loadMoreFailed={loadMoreFailed}
          renderRow={(send) => (
            <ListRow
              title={send.climbName}
              href={climbHref(send.climbId, send.climbName)}
              subtitle={
                <AreaBreadcrumb
                  areaId={send.areaId}
                  areaName={send.areaName}
                  ancestors={areaBreadcrumbs[send.areaId] ?? []}
                />
              }
              trailing={
                <div className="flex flex-col items-end gap-1 text-sm">
                  <SendGradeCell
                    type={send.climbType}
                    grade={send.climbGrade}
                    suggestedGrade={send.suggestedGrade}
                    gradeFeel={send.gradeFeel}
                    rating={send.rating}
                  />
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
