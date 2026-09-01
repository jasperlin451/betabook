"use client";

import { useEffect, useRef } from "react";
import { fetchSentClimbIds, MAX_SENT_CLIMB_ID_LOOKUP } from "@/lib/sent-climb-ids";

/** Re-asks the server which client-paged climbs the viewer has sent, each
 * time a server refresh re-renders the first page.
 *
 * The list pages send down sent ids for the first page only, so the payload
 * stays proportional to what is visible. That scoping leaves a gap these
 * lists would otherwise never close: log a send on a row the user paged in,
 * and `createSend`'s `refresh()` re-renders a first page that says nothing
 * about that row — while the client's accumulated set was captured before
 * the send. The row would keep offering "log a send" for a climb already
 * sent, and a second attempt fails on the unique constraint.
 *
 * A refresh is detected as a new `firstPageClimbs` identity: these sections
 * are keyed on sort+filter, so a refresh re-renders them in place rather
 * than remounting. `loadedClimbs` is read at that moment rather than
 * tracked, so paging in more rows doesn't re-ask — the page response those
 * rows arrived in already carried their sent ids. */
export function useSentClimbIdsRefresh<T extends { id: number }>({
  signedIn,
  firstPageClimbs,
  loadedClimbs,
  onRevalidated,
}: {
  signedIn: boolean;
  firstPageClimbs: readonly T[];
  loadedClimbs: readonly T[];
  onRevalidated: (tailSentClimbIds: Set<number>) => void;
}) {
  const loadedClimbsRef = useRef(loadedClimbs);
  const onRevalidatedRef = useRef(onRevalidated);
  useEffect(() => {
    loadedClimbsRef.current = loadedClimbs;
    onRevalidatedRef.current = onRevalidated;
  });

  // The first render is the server's own answer, not a refresh of it.
  const seenFirstPage = useRef(firstPageClimbs);

  useEffect(() => {
    if (seenFirstPage.current === firstPageClimbs) return;
    seenFirstPage.current = firstPageClimbs;
    if (!signedIn) return;

    const firstPageIds = new Set(firstPageClimbs.map((climb) => climb.id));
    const tailIds = loadedClimbsRef.current
      .map((climb) => climb.id)
      .filter((id) => !firstPageIds.has(id));
    if (tailIds.length === 0 || tailIds.length > MAX_SENT_CLIMB_ID_LOOKUP) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const sent = await fetchSentClimbIds(tailIds, controller.signal);
        onRevalidatedRef.current(new Set(sent));
      } catch {
        // Keep whatever sent state is already on screen. This only ever
        // refines rows the viewer paged in; a failure leaves them as they
        // were rather than blanking a correct-looking list.
      }
    })();
    return () => controller.abort();
  }, [firstPageClimbs, signedIn]);
}
