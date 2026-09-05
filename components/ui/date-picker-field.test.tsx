import { CalendarDate } from "@internationalized/date";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { DatePickerField } from "@/components/ui/date-picker-field";

type PickerProps = {
  value: CalendarDate | null;
  maxValue?: CalendarDate;
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

  it("leaves max unset when the caller passes none", () => {
    expect(renderPicker(baseProps).maxValue).toBeUndefined();
  });

  it("reports a picked day as the ISO string the form submits", () => {
    const onChange = vi.fn<(value: string) => void>();

    renderPicker({ ...baseProps, onChange }).onChange(new CalendarDate(2026, 8, 12));

    expect(onChange).toHaveBeenCalledWith("2026-08-12");
  });

  it("pads single-digit months and days so the ISO string stays sortable", () => {
    const onChange = vi.fn<(value: string) => void>();

    renderPicker({ ...baseProps, onChange }).onChange(new CalendarDate(2026, 1, 3));

    expect(onChange).toHaveBeenCalledWith("2026-01-03");
  });

  it("reports a cleared date as the empty string", () => {
    const onChange = vi.fn<(value: string) => void>();

    renderPicker({ ...baseProps, onChange }).onChange(null);

    expect(onChange).toHaveBeenCalledWith("");
  });
});
