"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import { MAX_CLIMB_SENDS_LIMIT } from "@/lib/sends";
import type { Climb, ClimbSendRow, ClimbSendsPage } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { AscentStyle } from "@/components/ascent-style";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { SendListShell } from "@/components/send-list-shell";
import { SendActionsMenu } from "@/components/send-actions-menu";

type ClimbSendListProps = {
  climb: Climb;
  /** The server-rendered first page; subsequent pages come from
   * /api/climbs/[id]/sends via "load more". */
  initialSends: ClimbSendRow[];
  initialHasMore: boolean;
  /** The signed-in viewer's own user id, if any — used to show the actions
   * menu on their own row (a user can only have one send per climb). */
  currentUserId?: string | null;
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
}: ClimbSendListProps) {
  const [sends, setSends] = useState(initialSends);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Post-mutation reconciliation, same as UserSendList: with only page 1
  // loaded, adopting the fresh props IS the reconcile; with extra pages
  // loaded, re-fetch the loaded range so corrected rows swap in without the
  // list collapsing under the user. `staleTailLength` non-null means a
  // reconcile fetch is due/in flight.
  const [prevInitialSends, setPrevInitialSends] = useState(initialSends);
  const [staleTailLength, setStaleTailLength] = useState<number | null>(null);
  if (initialSends !== prevInitialSends) {
    setPrevInitialSends(initialSends);
    const tailLength = sends.length - initialSends.length;
    if (tailLength > 0 && tailLength <= MAX_CLIMB_SENDS_LIMIT) {
      setStaleTailLength(tailLength);
    } else {
      // Either only page 1 is loaded (adopting the fresh props IS the
      // reconcile), or the tail exceeds what the route's clamped `limit`
      // can restore in one request — requesting it anyway would silently
      // truncate the range, so for that rare case drop back to the fresh
      // first page instead (same trade-off as UserSendList).
      setStaleTailLength(null);
      setSends(initialSends);
      setHasMore(initialHasMore);
    }
  }

  useEffect(() => {
    if (staleTailLength === null) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          offset: String(initialSends.length),
          limit: String(staleTailLength),
        });
        const res = await fetch(`/api/climbs/${climb.id}/sends?${params.toString()}`);
        if (!res.ok) throw new Error(`Reloading sends failed: ${res.status}`);
        const data: ClimbSendsPage = await res.json();
        if (cancelled) return;
        // Atomic swap of the whole loaded range — the stale rows stay
        // visible until this lands, so the layout never collapses.
        setSends([...initialSends, ...data.sends]);
        setHasMore(data.hasMore);
      } catch {
        if (cancelled) return;
        // Correctness over continuity: a deleted send must not keep ghosting
        // in the stale tail, so fall back to just the fresh first page and
        // let the inline error explain the shrink — the "load more" button
        // doubles as the retry.
        setSends(initialSends);
        setHasMore(initialHasMore);
        setLoadMoreFailed(true);
      } finally {
        if (!cancelled) setStaleTailLength(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staleTailLength, initialSends, initialHasMore, climb.id]);

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
      const params = new URLSearchParams({ offset: String(sends.length) });
      const res = await fetch(`/api/climbs/${climb.id}/sends?${params.toString()}`);
      if (!res.ok) throw new Error(`Loading more sends failed: ${res.status}`);
      const data: ClimbSendsPage = await res.json();
      // If a mutation refresh landed while this was in flight, this page was
      // fetched against a superseded ordering — drop it (the reconcile above
      // re-fetches the loaded range itself) rather than appending stale rows.
      if (latestInitialSends.current !== baseInitialSends) return;
      setSends((prev) => [...prev, ...data.sends]);
      setHasMore(data.hasMore);
    } catch {
      // Network failure or a non-2xx response — keep what's loaded, surface
      // an inline error, and leave the button as the retry affordance.
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <SendListShell
      sends={sends}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      // Also disabled while a post-mutation reconcile is re-fetching the
      // loaded range — a load-more against the superseded ordering would be
      // dropped anyway (see handleLoadMore).
      loadingMore={loadingMore || reconciling}
      loadMoreError={
        loadMoreFailed && (
          <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>
        )
      }
      renderRow={(send) => (
        <ListRow
          title={<AppLink href={`/users/${send.userId}`}>{send.userName}</AppLink>}
          subtitle={send.dateSent ?? "Date unknown"}
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  {formatGrade(climb.type, send.suggestedGrade)}
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
