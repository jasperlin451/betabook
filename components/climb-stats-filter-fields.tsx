"use client";

import { Label, NumberField } from "@heroui/react";
import { IndexRangeSelect } from "@/components/ui/index-select";
import { MAX_RATING_OPTIONS, MIN_RATING_OPTIONS } from "@/lib/climb-stats-filter";

/** Climb search's and the area page's rating-range filter — shared since
 * both list climbs via the same <ClimbList> and filter on the same
 * denormalized climbs.avg_rating column. */
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
      minOptions={MIN_RATING_OPTIONS}
      maxOptions={MAX_RATING_OPTIONS}
      minLabel="Min Rating"
      maxLabel="Max Rating"
      range={range}
      onChange={onChange}
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
    <NumberField value={value} onChange={onChange} minValue={0} fullWidth>
      <Label>Min Ascents</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
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
