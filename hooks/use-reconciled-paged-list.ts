"use client";

import { useEffect, useRef, useState } from "react";

export type ReconciledPage<T, Meta> = {
  items: T[];
  hasMore: boolean;
  meta: Meta;
};

type Options<T, Meta> = {
  initialItems: T[];
  initialHasMore: boolean;
  initialMeta: Meta;
  maxReconcileItems: number;
  itemKey: (item: T) => string | number;
  fetchPage: (offset: number, limit?: number) => Promise<ReconciledPage<T, Meta>>;
  mergeMeta: (current: Meta, ...incoming: Meta[]) => Meta;
};

/** Shared state machine for a server-rendered first page plus accumulated
 * client pages. A server-action refresh adopts the new first page and, when
 * necessary, atomically re-fetches the already-visible tail. In-flight pages
 * fetched against an older first-page ordering are discarded. */
export function useReconciledPagedList<T, Meta>({
  initialItems,
  initialHasMore,
  initialMeta,
  maxReconcileItems,
  itemKey,
  fetchPage,
  mergeMeta,
}: Options<T, Meta>) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [meta, setMeta] = useState(initialMeta);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [loadedBeyondFirstPage, setLoadedBeyondFirstPage] = useState(false);
  const [staleTailLength, setStaleTailLength] = useState<number | null>(null);
  const [previousInitialItems, setPreviousInitialItems] = useState(initialItems);

  const fetchPageRef = useRef(fetchPage);
  const mergeMetaRef = useRef(mergeMeta);
  const itemKeyRef = useRef(itemKey);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
    mergeMetaRef.current = mergeMeta;
    itemKeyRef.current = itemKey;
  });

  if (initialItems !== previousInitialItems) {
    setPreviousInitialItems(initialItems);
    const tailLength = items.length - initialItems.length;
    if (loadedBeyondFirstPage && tailLength > 0 && tailLength <= maxReconcileItems) {
      setStaleTailLength(tailLength);
    } else {
      setStaleTailLength(null);
      setLoadedBeyondFirstPage(false);
      setItems(initialItems);
      setHasMore(initialHasMore);
      setMeta((current) => mergeMetaRef.current(current, initialMeta));
    }
  }

  useEffect(() => {
    if (staleTailLength === null) return;
    let cancelled = false;

    void (async () => {
      try {
        const page = await fetchPageRef.current(initialItems.length, staleTailLength);
        if (cancelled) return;
        setItems([...initialItems, ...page.items]);
        setHasMore(page.hasMore);
        setMeta((current) =>
          mergeMetaRef.current(current, initialMeta, page.meta),
        );
      } catch {
        if (cancelled) return;
        setItems(initialItems);
        setHasMore(initialHasMore);
        setMeta((current) => mergeMetaRef.current(current, initialMeta));
        setLoadedBeyondFirstPage(false);
        setLoadMoreFailed(true);
      } finally {
        if (!cancelled) setStaleTailLength(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [staleTailLength, initialItems, initialHasMore, initialMeta]);

  const latestInitialItems = useRef(initialItems);
  useEffect(() => {
    latestInitialItems.current = initialItems;
  }, [initialItems]);

  async function loadMore() {
    if (loadingMore || staleTailLength !== null) return;
    const baseInitialItems = latestInitialItems.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const page = await fetchPageRef.current(items.length);
      if (latestInitialItems.current !== baseInitialItems) return;

      const existingKeys = new Set(items.map(itemKeyRef.current));
      const nextItems = page.items.filter((item) => !existingKeys.has(itemKeyRef.current(item)));
      if (page.hasMore && nextItems.length === 0) {
        throw new Error("Paged response did not advance");
      }

      setItems((current) => [...current, ...nextItems]);
      setMeta((current) => mergeMetaRef.current(current, page.meta));
      setLoadedBeyondFirstPage(true);
      setHasMore(page.hasMore);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    items,
    hasMore,
    meta,
    loadingMore: loadingMore || staleTailLength !== null,
    loadMoreFailed,
    loadMore,
  };
}
