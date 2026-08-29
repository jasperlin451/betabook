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

/** An `IndexSelect` with a visible label beside it, for a standalone
 * dropdown that isn't part of an `IndexRangeSelect` pair (whose own visible
 * label already gives the min/max selects context). */
export function LabeledIndexSelect({ label, options, index, onChange }: IndexSelectProps) {
  return (
    <div className="flex items-end gap-3">
      <span className="shrink-0 pb-2.5 text-sm font-medium">{label}</span>
      <IndexSelect label={label} options={options} index={index} onChange={onChange} />
    </div>
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
  /** Index (into either options list) whose option means "Any" — an
   * unbounded side rather than a real point on the scale. A bound at this
   * index neither clamps the other side nor gets clamped by it: picking a
   * min of 3 must not drag an "Any" max up to 3, and picking an "Any" max
   * must not drag the min toward it (which is how an "Any" max rating used
   * to zero out the min and return no results). Omit for ranges whose every
   * option is a real value (grades). */
  anyIndex?: number;
};

/** A min/max pair of `IndexSelect`s, clamped so min never exceeds max and
 * vice versa (except for an `anyIndex` bound, which is unbounded and so has
 * nothing to clamp against). `minOptions`/`maxOptions` are separate (not
 * just one `options` list) in case a range ever labels its endpoints
 * differently. */
export function IndexRangeSelect({
  label,
  minOptions,
  maxOptions,
  minLabel,
  maxLabel,
  range,
  onChange,
  anyIndex,
}: IndexRangeSelectProps) {
  const eitherIsAny = (min: number, max: number) => min === anyIndex || max === anyIndex;

  return (
    <div className="flex items-end gap-3">
      <span className="shrink-0 pb-2.5 text-sm font-medium">{label}</span>
      <IndexSelect
        label={minLabel}
        options={minOptions}
        index={range[0]}
        onChange={(min) =>
          onChange([min, eitherIsAny(min, range[1]) ? range[1] : Math.max(min, range[1])])
        }
      />
      <span className="pb-2.5 text-muted">–</span>
      <IndexSelect
        label={maxLabel}
        options={maxOptions}
        index={range[1]}
        onChange={(max) =>
          onChange([eitherIsAny(range[0], max) ? range[0] : Math.min(range[0], max), max])
        }
      />
    </div>
  );
}
