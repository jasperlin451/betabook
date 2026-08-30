"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import { formatDate } from "@/lib/format-date";
import type { AreaBreadcrumbs, RecentSendRow } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { AscentStyle } from "@/components/ascent-style";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { RatingStars } from "@/components/ui/rating-stars";

type FeedPageResponse = {
  sends: RecentSendRow[];
  hasMore: boolean;
  areaBreadcrumbs: AreaBreadcrumbs;
};

/** The home feed: latest sends across the whole book, one logbook entry per
 * row — the climb is the row target, the climber their own link, and the
 * trailing column reads like every other send row (grade, stars, style,
 * date). Server-rendered first page, /api/feed behind "load more". */
export function RecentSendsFeed({
  initialSends,
  initialHasMore,
  initialAreaBreadcrumbs,
}: {
  initialSends: RecentSendRow[];
  initialHasMore: boolean;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
}) {
  const [sends, setSends] = useState(initialSends);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [areaBreadcrumbs, setAreaBreadcrumbs] = useState(initialAreaBreadcrumbs);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [loadedPages, setLoadedPages] = useState(1);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const res = await fetch(`/api/feed?page=${loadedPages + 1}`);
      if (!res.ok) throw new Error(`Loading more sends failed: ${res.status}`);
      const data: FeedPageResponse = await res.json();
      setSends((prev) => [...prev, ...data.sends]);
      setHasMore(data.hasMore);
      setAreaBreadcrumbs((prev) => ({ ...prev, ...data.areaBreadcrumbs }));
      setLoadedPages((prev) => prev + 1);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (sends.length === 0) {
    return <EmptyState message="No sends logged yet — the book is waiting for its first entry." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-separator">
        {sends.map((send) => (
          <ListRow
            key={send.id}
            title={send.climbName}
            href={`/climbs/${send.climbId}`}
            subtitle={
              <span className="flex flex-wrap items-center gap-x-1.5">
                <AppLink href={`/users/${send.userId}`} className="text-sm">
                  {send.userName}
                </AppLink>
                <span aria-hidden>·</span>
                <AreaBreadcrumb
                  areaId={send.areaId}
                  areaName={send.areaName}
                  ancestors={areaBreadcrumbs[send.areaId] ?? []}
                />
              </span>
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
            comment={send.comment}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          {loadMoreFailed && (
            <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
          )}
          <LoadMoreButton onPress={handleLoadMore} loading={loadingMore} />
        </div>
      )}
    </div>
  );
}
