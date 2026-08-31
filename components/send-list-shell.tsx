"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMoreButton } from "@/components/ui/load-more-button";

type SendListShellProps<T extends { id: number }> = {
  /** The pages loaded so far — the caller owns pagination (server-driven
   * "load more"), this shell just renders what it's given. */
  sends: T[];
  renderRow: (send: T) => ReactNode;
  emptyState?: ReactNode;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  /** Inline error shown above the "load more" button when a page fetch
   * failed — the button itself stays as the retry affordance. */
  loadMoreError?: ReactNode;
};

/** Shared empty-state + "load more" + row-list structure for a list of
 * sends. Used by ClimbSendList and UserSendList, both of which page from the
 * server via `onLoadMore` — there's deliberately no client-side slicing mode
 * here, since a fully loaded array is exactly what server pagination exists
 * to avoid. */
export function SendListShell<T extends { id: number }>({
  sends,
  renderRow,
  emptyState = <EmptyState message="No sends yet." />,
  hasMore,
  onLoadMore,
  loadingMore = false,
  loadMoreError,
}: SendListShellProps<T>) {
  if (sends.length === 0) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-separator">
        {sends.map((send) => (
          <div key={send.id}>{renderRow(send)}</div>
        ))}
      </div>
      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          {loadMoreError}
          <LoadMoreButton onPress={onLoadMore} loading={loadingMore} />
        </div>
      )}
    </div>
  );
}
