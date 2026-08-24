"use client";

import { useState, type ReactNode } from "react";
import { LoadMoreButton } from "@/components/ui/load-more-button";

const PAGE_SIZE = 10;

type SendListShellProps<T extends { id: number }> = {
  sends: T[];
  renderRow: (send: T) => ReactNode;
};

/** Shared empty-state + pagination + row-list structure for a list of
 * sends. Used by ClimbSendList. */
export function SendListShell<T extends { id: number }>({
  sends,
  renderRow,
}: SendListShellProps<T>) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (sends.length === 0) {
    return <p className="text-muted text-sm">No sends yet.</p>;
  }

  const shown = sends.slice(0, visibleCount);
  const hasMore = shown.length < sends.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-separator">
        {shown.map((send) => (
          <div key={send.id}>{renderRow(send)}</div>
        ))}
      </div>
      {hasMore && (
        <LoadMoreButton onPress={() => setVisibleCount((count) => count + PAGE_SIZE)} loading={false} />
      )}
    </div>
  );
}
