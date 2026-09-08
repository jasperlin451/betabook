"use client";

import { FILTER_ROW_CLASS } from "@/components/ui/field";
import { RatingField } from "@/components/ui/rating-field";

/** A full 1–5 range is unfiltered; narrowing either side keeps the bounds ordered. */
export function RatingRangeFilter({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const min = value[0] || 1;
  const max = value[1] || 5;
  return (
    <div role="group" aria-label="Rating range" className={`${FILTER_ROW_CLASS} sm:items-center`}>
      <span className="text-sm font-medium">Rating</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <RatingField
          label="Min rating"
          hideLabel
          value={min}
          compact
          allowClear={false}
          onValueChange={(rating) => {
            const next = rating ?? 1;
            onChange([next, Math.max(next, max)]);
          }}
        />
        <span aria-hidden className="text-muted">
          –
        </span>
        <RatingField
          label="Max rating"
          hideLabel
          value={max}
          compact
          allowClear={false}
          onValueChange={(rating) => {
            const next = rating ?? 5;
            onChange([Math.min(min, next), next]);
          }}
        />
      </div>
    </div>
  );
}
