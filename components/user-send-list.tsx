"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import { ASCENT_STYLES, type AscentStyle as AscentStyleType } from "@/lib/sends";
import { DEFAULT_USER_SENDS_FILTER, userSendsFilterToSearchParams } from "@/lib/user-sends-filter";
import type { AreaBreadcrumbs, UserSendRow, UserSendsFilter } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { AscentStyle } from "@/components/ascent-style";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { LabeledIndexSelect } from "@/components/ui/index-select";
import { SendActionsMenu } from "@/components/send-actions-menu";
import { SendListShell } from "@/components/send-list-shell";
import { SortSelect } from "@/components/ui/sort-select";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";

const MIN_RATING_OPTIONS = ["Any", "1", "2", "3", "4", "5"];

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
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
    </div>
  );
}

function MinRatingSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <LabeledIndexSelect label="Min Rating" options={MIN_RATING_OPTIONS} index={value} onChange={onChange} />
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

/** The name/area search + discipline/grade filter for a user's send history
 * — split out from <UserSendList> so the page can place it in a sidebar
 * column alongside the stats cards, while the send rows themselves stay in
 * the main column. Debounces every field change (including the initial
 * render) into a single navigation, same as the climb search form.
 *
 * Unlike <UserSendList>, the caller must NOT key this on the filter: this
 * component owns its own state and is what drives the navigation, so a
 * filter change is always self-inflicted, never an external resync. Keying
 * it would remount it (and its <input>s) right when the debounce lands —
 * exactly when the user pauses typing — yanking focus out from under them. */
export function UserSendsFilterPanel({
  userId,
  filter,
}: {
  userId: string;
  filter: UserSendsFilter;
}) {
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
    buildHref: (disciplineFilter, name, areaName) =>
      `/users/${userId}?${userSendsFilterToSearchParams({ ...disciplineFilter, name, areaName }).toString()}`,
  });

  return (
    <DisciplineFilterForm
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={reset}
      name={name}
      onNameChange={setName}
      areaName={areaName}
      onAreaNameChange={setAreaName}
      extraOptions={
        <>
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

/** A user's send history: server-rendered first page, filters that navigate
 * (so the server can re-filter with real SQL), and a "load more" button
 * that fetches subsequent pages from /api/users/[id]/sends — a user's send
 * count can run into the thousands, so this never holds more in memory or
 * transfers more over the wire than what's actually been scrolled to.
 *
 * The caller keys this component on the filter (see app/users/[id]/page.tsx)
 * so a filter change remounts it with fresh initial state, rather than this
 * component syncing local state to changed props via an effect. */
export function UserSendList({
  userId,
  filter,
  initialSends,
  initialHasMore,
  initialAreaBreadcrumbs,
  hasAnySends,
  currentUserId,
}: UserSendListProps) {
  const router = useRouter();
  const [sends, setSends] = useState(initialSends);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const params = userSendsFilterToSearchParams(filter);
      params.set("offset", String(sends.length));
      const res = await fetch(`/api/users/${userId}/sends?${params.toString()}`);
      const data: { sends: UserSendRow[]; hasMore: boolean; areaBreadcrumbs: AreaBreadcrumbs } =
        await res.json();
      setSends((prev) => [...prev, ...data.sends]);
      setHasMore(data.hasMore);
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
    } finally {
      setLoadingMore(false);
    }
  }

  const currentSort = filter.sort ?? "date_desc";

  if (!hasAnySends) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Sends</h2>
        <p className="text-muted text-sm">
          {currentUserId === userId ? (
            <>
              No sends yet. <AppLink href="/account/import">Import your sends</AppLink> to add them here.
            </>
          ) : (
            "No sends yet."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sends</h2>
        <SortSelect
          sort={currentSort}
          fields={SORT_FIELDS}
          defaultField="date"
          defaultDirection={DEFAULT_DIRECTION}
          onNavigate={(nextSort) => {
            const params = userSendsFilterToSearchParams({ ...filter, sort: nextSort });
            router.replace(`/users/${userId}?${params.toString()}`, { scroll: false });
          }}
        />
      </div>
      <SendListShell
        sends={sends}
        emptyState={<p className="text-muted text-sm">No sends match these filters.</p>}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        renderRow={(send) => (
          <ListRow
            title={
              <AppLink href={`/climbs/${send.climbId}`} className="block w-full truncate">
                {send.climbName}
              </AppLink>
            }
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
                  <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
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
                  </span>
                  <span className="text-muted" aria-hidden>
                    •
                  </span>
                  <RatingStars rating={send.rating} />
                </div>
                <AscentStyle type={send.ascentStyle} />
                <div className="text-xs text-muted/70">{send.dateSent ?? "Date unknown"}</div>
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
    </div>
  );
}
