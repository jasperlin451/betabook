"use client";

import { useState, type ReactNode } from "react";

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

  if (sends.length === 0) {
    return <p className="text-muted text-sm">No sends yet.</p>;
  }

  const visible = filterSends(sends, filters);
  return (
    <div className="flex flex-col gap-4">
      {renderFilterForm(filters, setFilters)}
      {visible.length === 0 ? (
        <p className="text-muted text-sm">No sends match these filters.</p>
      ) : (
        <div className="flex flex-col divide-y divide-separator">
          {visible.map((send) => (
            <div key={send.id}>{renderRow(send)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
