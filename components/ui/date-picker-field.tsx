"use client";

import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";

/** Both forms hold their date as the ISO `YYYY-MM-DD` string they put in
 * FormData, so the conversion lives here rather than at each call site. */
function toCalendarDate(value: string | undefined): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export type DatePickerFieldProps = {
  label: string;
  /** ISO `YYYY-MM-DD`, or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable day, ISO — later days render struck through. */
  max?: string;
  isReadOnly?: boolean;
};

/** The app's date field: a segmented text input plus a calendar popover, both
 * drawn from the theme tokens.
 *
 * `<input type="date">` was the alternative, and its popover is the browser's:
 * a white sheet with a system-blue selection and Chrome's own Clear/Today
 * links, none of which follow the paper/ink themes or re-theme with the
 * palette — and it looks different in every browser. This is HeroUI's
 * DatePicker, so the selected day wears `--accent`, today wears the soft
 * accent, and the popover sits on `--overlay` like every other one.
 *
 * The month heading doubles as a year picker (the native control's only
 * feature this would otherwise drop), which backfilling old sends needs. */
export function DatePickerField({ label, value, onChange, max, isReadOnly }: DatePickerFieldProps) {
  return (
    <DatePicker
      className="w-full"
      value={toCalendarDate(value)}
      maxValue={toCalendarDate(max) ?? undefined}
      isReadOnly={isReadOnly}
      // Segments are padded individually, so an unpadded month and day make the
      // field's width jump as you tab across it.
      shouldForceLeadingZeros
      onChange={(date) => onChange(date?.toString() ?? "")}
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.InputContainer>
          <DateField.Input>
            {(segment: DateField["SegmentProps"]["segment"]) => (
              <DateField.Segment segment={segment} />
            )}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody />
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
