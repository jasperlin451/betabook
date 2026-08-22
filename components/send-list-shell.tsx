"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@heroui/react";

const PAGE_SIZE = 10;

type SendListShellProps<T extends { id: number }, F> = {
  sends: T[];
  defaultFilters: F;
  filterSends: (sends: T[], filters: F) => T[];
  renderFilterForm: (filters: F, onChange: (filters: F) => void) => ReactNode;
  renderRow: (send: T) => ReactNode;
};

/** Shared filter + empty-state + row-list structure for a list of sends.
 * `ClimbSendList` and `UserSendList` fill in the row shape and filter type
 * via composition rather than branching on a context prop here. */
export function SendListShell<T extends { id: number }, F>({
  sends,
  defaultFilters,
  filterSends,
  renderFilterForm,
  renderRow,
}: SendListShellProps<T, F>) {
  const [filters, setFilters] = useState(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (sends.length === 0) {
    return <p className="text-muted text-sm">No sends yet.</p>;
  }

  const visible = filterSends(sends, filters);
  const shown = visible.slice(0, visibleCount);
  const hasMore = shown.length < visible.length;

  return (
    <div className="flex flex-col gap-4">
      {renderFilterForm(filters, (next) => {
        setFilters(next);
        setVisibleCount(PAGE_SIZE);
      })}
      {visible.length === 0 ? (
        <p className="text-muted text-sm">No sends match these filters.</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-separator">
            {shown.map((send) => (
              <div key={send.id}>{renderRow(send)}</div>
            ))}
          </div>
          {hasMore && (
            <Button
              variant="ghost"
              className="self-center"
              onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
