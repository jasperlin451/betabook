import { Calendar } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DatePickerField } from "@/components/ui/date-picker-field";

type PickerProps = {
  value: CalendarDate | null;
  maxValue: CalendarDate | null;
  onChange: (date: CalendarDate | null) => void;
  children: ReactNode;
};

/** Reads the bound props off the element tree — the Workers pool has no DOM. */
function renderPicker(props: Parameters<typeof DatePickerField>[0]) {
  return (DatePickerField(props) as ReactElement<PickerProps>).props;
}

function findElement(node: ReactNode, type: unknown): ReactElement<PickerProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === type) return node as ReactElement<PickerProps>;
  return findElement(node.props.children, type);
}

const baseProps = { label: "Date", value: "2026-08-12", onChange: () => {} };

describe("DatePickerField", () => {
  it("binds the ISO value and max as calendar dates", () => {
    const props = renderPicker({ ...baseProps, max: "2026-09-05" });

    expect(props.value).toEqual(new CalendarDate(2026, 8, 12));
    expect(props.maxValue).toEqual(new CalendarDate(2026, 9, 5));
  });

  it.each(["", "not-a-date", "2026-13-45"])("binds no date for %o", (value) => {
    expect(renderPicker({ ...baseProps, value }).value).toBeNull();
  });

  it("bounds nothing when the caller passes no max", () => {
    expect(renderPicker(baseProps).maxValue).toBeNull();
  });

  // The grid keeps its own copy of the bound; the root's was never the broken one.
  it.each([
    ["2026-09-05", new CalendarDate(2026, 9, 5)],
    [undefined, null],
  ])("passes max %o down to the calendar grid", (max, expected) => {
    const calendar = findElement(renderPicker({ ...baseProps, max }).children, Calendar);

    expect(calendar).not.toBeNull();
    expect(calendar?.props.maxValue).toEqual(expected);
  });

  // The padded case matters: these strings are stored and sorted lexically.
  it.each([
    [new CalendarDate(2026, 8, 12), "2026-08-12"],
    [new CalendarDate(2026, 1, 3), "2026-01-03"],
  ])("reports %s as the ISO string the form submits", (picked, iso) => {
    const onChange = vi.fn<(value: string) => void>();

    renderPicker({ ...baseProps, onChange }).onChange(picked);

    expect(onChange).toHaveBeenCalledWith(iso);
  });

  it("reports a cleared date as the empty string", () => {
    const onChange = vi.fn<(value: string) => void>();

    renderPicker({ ...baseProps, onChange }).onChange(null);

    expect(onChange).toHaveBeenCalledWith("");
  });
});
