"use client";

import { formatDate } from "@/lib/format-date";
import type { AreaBreadcrumbs, RecentSendRow } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { AscentStyle } from "@/components/ascent-style";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { SendGradeCell } from "@/components/send-grade-cell";
import { usePagedList } from "@/hooks/use-paged-list";

type FeedPageResponse = {
  sends: RecentSendRow[];
  hasMore: boolean;
  areaBreadcrumbs: AreaBreadcrumbs;
};

/** The home feed: latest sends across the whole book, one logbook entry
 * per row, shaped exactly like a row of UserSendList — the route names the
 * row, the area sits as quiet context beneath, and grade/stars/style/date
 * stack in the trailing data column. What the profile list doesn't need and
 * this one does is the "who", which lines up above the comment.
 * Server-rendered first page, /api/feed behind
 * "load more" via the same `usePagedList` state every other list uses. */
export function RecentSendsFeed({
  initialSends,
  initialHasMore,
  initialAreaBreadcrumbs,
}: {
  initialSends: RecentSendRow[];
  initialHasMore: boolean;
  initialAreaBreadcrumbs: AreaBreadcrumbs;
}) {
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
    fetchPage: async (_offset, page) => {
      const res = await fetch(`/api/feed?page=${page}`);
      if (!res.ok) throw new Error(`Loading more sends failed: ${res.status}`);
      const data: FeedPageResponse = await res.json();
      return { items: data.sends, hasMore: data.hasMore, meta: data.areaBreadcrumbs };
    },
  });

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
            // The climber attributes the note rather than titling the row:
            // the route is what the row is about, but a feed still has to say
            // whose send this is — so the name sits on its own line above the
            // comment, and shows even on a send with no comment at all.
            commentAuthor={
              <AppLink href={`/users/${send.userId}`}>{send.userName}</AppLink>
            }
            comment={send.comment}
          />
        ))}
      </div>
      {hasMore && <LoadMoreButton onPress={loadMore} loading={loadingMore} failed={loadMoreFailed} />}
    </div>
  );
}
