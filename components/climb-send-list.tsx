"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import { formatDate } from "@/lib/format-date";
import { MAX_CLIMB_SENDS_LIMIT } from "@/lib/sends";
import type { Climb, ClimbSendRow, ClimbSendsPage } from "@/db/queries";
import { AscentStyle } from "@/components/ascent-style";
import { RatingStars } from "@/components/ui/rating-stars";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { SendListShell } from "@/components/send-list-shell";
import { SendActionsMenu } from "@/components/send-actions-menu";
import { useReconciledPagedList } from "@/hooks/use-reconciled-paged-list";

type ClimbSendListProps = {
  climb: Climb;
  /** The server-rendered first page; subsequent pages come from
   * /api/climbs/[id]/sends via "load more". */
  initialSends: ClimbSendRow[];
  initialHasMore: boolean;
  /** The signed-in viewer's own user id, if any — used to show the actions
   * menu on their own row (a user can only have one send per climb). */
  currentUserId?: string | null;
  /** Rendered when the climb has no sends — the page supplies a
   * first-ascent invitation (see app/climbs/[id]/page.tsx). */
  emptyState?: ReactNode;
};

/** Community ascents for a single climb — one row per climber, paged from
 * the server the same way UserSendList is: server-rendered first page,
 * "load more" fetching subsequent pages, and post-mutation reconciliation of
 * the accumulated pages (a viewer editing/deleting their own send makes the
 * server action refresh() the route, which arrives as a new `initialSends`
 * prop identity — see UserSendList for the full reasoning on each piece). */
export function ClimbSendList({
  climb,
  initialSends,
  initialHasMore,
  currentUserId,
  emptyState,
}: ClimbSendListProps) {
  const {
    items: sends,
    hasMore,
    loadingMore,
    loadMoreFailed,
    loadMore,
  } = useReconciledPagedList<ClimbSendRow, null>({
    initialItems: initialSends,
    initialHasMore,
    initialMeta: null,
    maxReconcileItems: MAX_CLIMB_SENDS_LIMIT,
    itemKey: (send) => send.id,
    mergeMeta: () => null,
    fetchPage: async (offset, limit) => {
      const params = new URLSearchParams({ offset: String(offset) });
      if (limit !== undefined) params.set("limit", String(limit));
      const res = await fetch(`/api/climbs/${climb.id}/sends?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading sends failed: ${res.status}`);
      const data: ClimbSendsPage = await res.json();
      return { items: data.sends, hasMore: data.hasMore, meta: null };
    },
  });

  return (
    <SendListShell
      sends={sends}
      emptyState={emptyState}
      hasMore={hasMore}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
      loadMoreError={
        loadMoreFailed && (
          <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
        )
      }
      renderRow={(send) => (
        <ListRow
          title={send.userName}
          href={`/users/${send.userId}`}
          subtitle={formatDate(send.dateSent)}
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <Grade>
                  {formatGrade(climb.type, send.suggestedGrade)}
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
            </div>
          }
          actions={
            send.userId === currentUserId && <SendActionsMenu climb={climb} send={send} />
          }
          comment={send.comment}
        />
      )}
    />
  );
}
