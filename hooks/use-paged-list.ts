"use client";

import { useState } from "react";

type PagedListPage<T, Meta> = {
  items: T[];
  hasMore: boolean;
  meta: Meta;
};

type Options<T, Meta> = {
  initialItems: T[];
  initialHasMore: boolean;
  initialMeta: Meta;
  itemKey: (item: T) => string | number;
  /** Receives both the number of unique rows currently rendered and the
   * one-based page number to request. Offset-backed callers use the first;
   * page-backed callers use the second. */
  fetchPage: (offset: number, page: number) => Promise<PagedListPage<T, Meta>>;
  mergeMeta: (current: Meta, incoming: Meta) => Meta;
};

/** State for a server-rendered first page with client-side "load more".
 * A refreshed server snapshot replaces the accumulated list; preserving and
 * re-fetching the old tail is intentionally not part of this hook. */
export function usePagedList<T, Meta>({
  initialItems,
  initialHasMore,
  initialMeta,
  itemKey,
  fetchPage,
  mergeMeta,
}: Options<T, Meta>) {
  const [state, setState] = useState(() => ({
    sourceItems: initialItems,
    items: initialItems,
    hasMore: initialHasMore,
    meta: initialMeta,
    pagesLoaded: 1,
    loadingMore: false,
    loadMoreFailed: false,
  }));

  // A Server Action refresh delivers a new first-page snapshot without
  // remounting this Client Component. Reset to that authoritative snapshot
  // immediately. Async responses compare the same identity before updating,
  // so a page fetched for the previous snapshot is discarded.
  if (state.sourceItems !== initialItems) {
    setState({
      sourceItems: initialItems,
      items: initialItems,
      hasMore: initialHasMore,
      meta: initialMeta,
      pagesLoaded: 1,
      loadingMore: false,
      loadMoreFailed: false,
    });
  }

  async function loadMore() {
    if (state.loadingMore || !state.hasMore) return;

    const sourceItems = state.sourceItems;
    setState((current) =>
      current.sourceItems === sourceItems
        ? { ...current, loadingMore: true, loadMoreFailed: false }
        : current,
    );

    try {
      const page = await fetchPage(state.items.length, state.pagesLoaded + 1);

      const existingKeys = new Set(state.items.map(itemKey));
      const nextItems = page.items.filter((item) => !existingKeys.has(itemKey(item)));
      if (page.hasMore && nextItems.length === 0) {
        throw new Error("Paged response did not advance");
      }

      setState((current) =>
        current.sourceItems === sourceItems
          ? {
              ...current,
              items: [...current.items, ...nextItems],
              hasMore: page.hasMore,
              meta: mergeMeta(current.meta, page.meta),
              pagesLoaded: current.pagesLoaded + 1,
              loadingMore: false,
            }
          : current,
      );
    } catch {
      setState((current) =>
        current.sourceItems === sourceItems
          ? { ...current, loadingMore: false, loadMoreFailed: true }
          : current,
      );
    }
  }

  return {
    items: state.items,
    hasMore: state.hasMore,
    meta: state.meta,
    loadingMore: state.loadingMore,
    loadMoreFailed: state.loadMoreFailed,
    loadMore,
  };
}
