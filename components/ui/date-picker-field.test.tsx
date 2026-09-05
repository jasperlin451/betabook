import { CalendarDate } from "@internationalized/date";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { DatePickerField } from "@/components/ui/date-picker-field";

type PickerProps = {
  value: CalendarDate | null;
  maxValue: CalendarDate | null;
  onChange: (date: CalendarDate | null) => void;
};

/** The component renders HeroUI's DatePicker as its root, and the date it
 * binds lives entirely in that element's props — no DOM needed to read them,
 * which the Workers test pool doesn't have. */
function renderPicker(props: Parameters<typeof DatePickerField>[0]) {
  return (DatePickerField(props) as ReactElement<PickerProps>).props;
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

  // The padded case is the one that matters: the forms submit these strings and
  // the column sorts lexically, so an unpadded month would order wrongly.
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
