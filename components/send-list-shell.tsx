"use client";

import { useState, type ReactNode } from "react";
import { LoadMoreButton } from "@/components/ui/load-more-button";

const PAGE_SIZE = 10;

type SendListShellProps<T extends { id: number }> = {
  sends: T[];
  renderRow: (send: T) => ReactNode;
  emptyState?: ReactNode;
  /** Server-driven pagination: when `onLoadMore` is provided, `sends` is
   * treated as already the current page and `hasMore`/`loadingMore` drive
   * the button directly, instead of slicing `sends` by `visibleCount`. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** Inline error shown above the "load more" button when a server-driven
   * page fetch failed — the button itself stays as the retry affordance. */
  loadMoreError?: ReactNode;
};

/** Shared empty-state + pagination + row-list structure for a list of
 * sends. Used by ClimbSendList (client-side slice of a fully loaded array)
 * and UserSendList (server-driven paging via `onLoadMore`). */
export function SendListShell<T extends { id: number }>({
  sends,
  renderRow,
  emptyState = <p className="text-muted text-sm">No sends yet.</p>,
  hasMore,
  onLoadMore,
  loadingMore = false,
  loadMoreError,
}: SendListShellProps<T>) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (sends.length === 0) {
    return emptyState;
  }

  const shown = onLoadMore ? sends : sends.slice(0, visibleCount);
  const showMore = onLoadMore ? (hasMore ?? false) : shown.length < sends.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-separator">
        {shown.map((send) => (
          <div key={send.id}>{renderRow(send)}</div>
        ))}
      </div>
      {showMore && (
        <div className="flex flex-col items-center gap-2">
          {loadMoreError}
          <LoadMoreButton
            onPress={onLoadMore ?? (() => setVisibleCount((count) => count + PAGE_SIZE))}
            loading={loadingMore}
          />
        </div>
      )}
    </div>
  );
}
