"use client";

import { NumberField } from "@heroui/react";
import { IndexRangeSelect } from "@/components/ui/index-select";
import { RATING_OPTIONS } from "@/lib/climb-stats-filter";

/** Climb search's and the area page's rating-range filter — shared since
 * both list climbs via the same <ClimbList> and filter on the same
 * denormalized climbs.avg_rating column. Index = rating value on both
 * sides, with 0 ("Any", `anyIndex`) meaning that bound is inactive — see
 * RATING_OPTIONS in lib/climb-stats-filter.ts. */
export function RatingRangeSelect({
  range,
  onChange,
}: {
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  return (
    <IndexRangeSelect
      label="Rating"
      minOptions={RATING_OPTIONS}
      maxOptions={RATING_OPTIONS}
      minLabel="Min Rating"
      maxLabel="Max Rating"
      range={range}
      onChange={onChange}
      anyIndex={0}
    />
  );
}

/** Minimum logged-ascent-count filter, over climbs.send_count — a free-form
 * count rather than a fixed set of steps, so a plain number input fits
 * better than a dropdown. 0 means the filter is inactive. */
export function MinAscentsField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    // Inline label + compact stepper, matching the Rating row's
    // label-beside-controls rhythm — a count field has no business
    // spanning the whole filter panel.
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-foreground">Min Ascents</span>
      <NumberField
        value={value}
        onChange={onChange}
        minValue={0}
        aria-label="Min Ascents"
        className="w-32"
      >
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  );
}

export function ClimbStatsFields({
  ratingRange,
  onRatingRangeChange,
  minAscents,
  onMinAscentsChange,
}: {
  ratingRange: [number, number];
  onRatingRangeChange: (range: [number, number]) => void;
  minAscents: number;
  onMinAscentsChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
      <RatingRangeSelect range={ratingRange} onChange={onRatingRangeChange} />
      <MinAscentsField value={minAscents} onChange={onMinAscentsChange} />
    </div>
  );
}
