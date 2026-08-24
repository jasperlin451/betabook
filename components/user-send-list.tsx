"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Link } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import { DEFAULT_USER_SENDS_FILTER, userSendsFilterToSearchParams } from "@/lib/user-sends-filter";
import type { AreaBreadcrumbs, UserSendRow, UserSendsFilter } from "@/db/queries";
import { AscentType } from "@/components/ascent-type";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { SendActionsMenu } from "@/components/send-actions-menu";

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

const SEARCH_DEBOUNCE_MS = 400;

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
  const router = useRouter();

  const [name, setName] = useState(filter.name ?? "");
  const [areaName, setAreaName] = useState(filter.areaName ?? "");
  const [disciplineFilter, setDisciplineFilter] = useState<UserSendsFilter>({
    disciplines: filter.disciplines,
    boulderRange: filter.boulderRange,
    sportRange: filter.sportRange,
    tradRange: filter.tradRange,
  });

  useEffect(() => {
    const params = userSendsFilterToSearchParams({ ...disciplineFilter, name, areaName });
    const timeout = setTimeout(() => {
      router.replace(`/users/${userId}?${params.toString()}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [disciplineFilter, name, areaName, userId, router]);

  function handleReset() {
    setName("");
    setAreaName("");
    setDisciplineFilter(DEFAULT_USER_SENDS_FILTER);
  }

  return (
    <DisciplineFilterForm
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={handleReset}
      name={name}
      onNameChange={setName}
      areaName={areaName}
      onAreaNameChange={setAreaName}
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

  if (!hasAnySends) {
    return <p className="text-muted text-sm">No sends yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sends.length === 0 ? (
        <p className="text-muted text-sm">No sends match these filters.</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-separator">
            {sends.map((send) => (
              <ListRow
                key={send.id}
                title={<Link href={`/climbs/${send.climbId}`}>{send.climbName}</Link>}
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
                      <span className="font-medium text-foreground">
                        {formatGrade(send.climbType, send.climbGrade)}
                        {send.suggestedGrade != null && send.suggestedGrade !== send.climbGrade && (
                          <span className="font-normal text-muted">
                            {" "}
                            ({formatGrade(send.climbType, send.suggestedGrade)})
                          </span>
                        )}
                      </span>
                      <span className="text-muted" aria-hidden>
                        •
                      </span>
                      <RatingStars rating={send.rating} />
                    </div>
                    <AscentType type={send.completionType} />
                    <div className="text-xs text-muted/70">{send.dateSent ?? "Date unknown"}</div>
                  </div>
                }
                actions={
                  currentUserId === userId && (
                    <SendActionsMenu
                      climb={{
                        id: send.climbId,
                        areaId: send.areaId,
                        name: send.climbName,
                        type: send.climbType,
                        grade: send.climbGrade,
                      }}
                      send={send}
                    />
                  )
                }
                comment={send.comment}
              />
            ))}
          </div>
          {hasMore && (
            <Button
              variant="ghost"
              className="self-center"
              onPress={handleLoadMore}
              isDisabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
