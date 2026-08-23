"use client";

import { useState } from "react";
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

type UserSendListProps = {
  userId: string;
  filter: UserSendsFilter;
  initialSends: UserSendRow[];
  initialHasMore: boolean;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
  /** Whether the user has any sends at all, regardless of the current
   * filter — distinguishes "no sends logged yet" from "none match". */
  hasAnySends: boolean;
};

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
}: UserSendListProps) {
  const router = useRouter();
  const [sends, setSends] = useState(initialSends);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleFilterChange(next: UserSendsFilter) {
    const params = userSendsFilterToSearchParams(next);
    router.replace(`/users/${userId}?${params.toString()}`, { scroll: false });
  }

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
      <DisciplineFilterForm
        value={filter}
        onChange={handleFilterChange}
        onReset={() => handleFilterChange(DEFAULT_USER_SENDS_FILTER)}
        showNameSearch={false}
      />
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
