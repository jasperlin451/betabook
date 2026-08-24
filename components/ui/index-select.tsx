"use client";

import { ListBox, Select } from "@heroui/react";

type IndexSelectProps = {
  label: string;
  options: readonly string[];
  index: number;
  onChange: (index: number) => void;
};

/** A `Select` whose selection is an index into `options`, rather than the
 * option's own value — shared by every "discrete-step dropdown" (grade,
 * rating, ...) in the app. */
export function IndexSelect({ label, options, index, onChange }: IndexSelectProps) {
  return (
    <Select
      aria-label={label}
      selectedKey={String(index)}
      onSelectionChange={(key) => onChange(Number(key))}
    >
      <Select.Trigger className="w-20">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option, i) => (
            <ListBox.Item key={i} id={String(i)}>
              {option}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

type IndexRangeSelectProps = {
  label: string;
  minOptions: readonly string[];
  maxOptions: readonly string[];
  minLabel: string;
  maxLabel: string;
  range: [number, number];
  onChange: (range: [number, number]) => void;
};

/** A min/max pair of `IndexSelect`s, clamped so min never exceeds max and
 * vice versa. `minOptions`/`maxOptions` are separate (not just one
 * `options` list) since some ranges label their endpoints differently —
 * e.g. a rating range's max option list includes "Any" where its min
 * doesn't. */
export function IndexRangeSelect({
  label,
  minOptions,
  maxOptions,
  minLabel,
  maxLabel,
  range,
  onChange,
}: IndexRangeSelectProps) {
  return (
    <div className="flex items-end gap-3">
      <span className="shrink-0 pb-2.5 text-sm font-medium">{label}</span>
      <IndexSelect
        label={minLabel}
        options={minOptions}
        index={range[0]}
        onChange={(min) => onChange([min, Math.max(min, range[1])])}
      />
      <span className="pb-2.5 text-muted">–</span>
      <IndexSelect
        label={maxLabel}
        options={maxOptions}
        index={range[1]}
        onChange={(max) => onChange([Math.min(range[0], max), max])}
      />
    </div>
  );
}
