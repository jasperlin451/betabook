"use client";

import { Label, TextField } from "@heroui/react";
import type { ReactNode } from "react";

import { ASCENT_STYLE_CHIP_CLASSNAME, ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { choicePillClass } from "@/components/ui/choice-pill";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { ASCENT_STYLES, GRADE_FEEL_VALUES, type AscentStyle, type GradeFeel } from "@/lib/sends";

export function FormSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </section>
  );
}

export const GRADE_FEEL_LABELS: Record<GradeFeel, string> = {
  low: "Low end",
  solid: "Solid",
  high: "High end",
};

const GRADE_FEEL_OPTIONS = GRADE_FEEL_VALUES.map((value) => ({
  value,
  label: GRADE_FEEL_LABELS[value],
}));

export function AscentStylePicker({
  value,
  onChange,
}: {
  value: AscentStyle;
  onChange: (value: AscentStyle) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ascent style" className="flex flex-wrap gap-1.5">
      {ASCENT_STYLES.map((style) => {
        const selected = value === style;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(style)}
            className={choicePillClass(selected, ASCENT_STYLE_CHIP_CLASSNAME[style])}
          >
            {ASCENT_STYLE_LABELS[style]}
          </button>
        );
      })}
    </div>
  );
}

export type SendStyleChoice = AscentStyle | "session";

/** One pill row deciding what the entry records: Session logs plain time on
 * the climb, while any ascent style marks it as a send in that style. */
export function SendStylePicker({
  value,
  onChange,
}: {
  value: SendStyleChoice;
  onChange: (value: SendStyleChoice) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Session or send" className="flex flex-wrap gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === "session"}
        onClick={() => onChange("session")}
        className={choicePillClass(value === "session", "bg-foreground text-background")}
      >
        Session
      </button>
      {ASCENT_STYLES.map((style) => {
        const selected = value === style;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(style)}
            className={choicePillClass(selected, ASCENT_STYLE_CHIP_CLASSNAME[style])}
          >
            {ASCENT_STYLE_LABELS[style]}
          </button>
        );
      })}
    </div>
  );
}

export function SuggestedGradeField({
  climbType,
  value,
  onChange,
}: {
  climbType: ClimbType;
  value: string;
  onChange: (value: string) => void;
}) {
  const gradeOptions = nativeGradeArray(climbType);

  return (
    <TextField>
      <Label>Suggested grade</Label>
      <OptionSelect
        ariaLabel="Suggested grade"
        className={FIELD_WIDTH_CLASS.short}
        value={value}
        onChange={onChange}
        options={gradeOptions.map((label, i) => ({ value: String(i), label }))}
      />
    </TextField>
  );
}

export function GradeFeelField({
  value,
  onChange,
}: {
  value: GradeFeel;
  onChange: (value: GradeFeel) => void;
}) {
  return (
    <TextField>
      <Label>Grade feel</Label>
      <SegmentedButtons value={value} onChange={onChange} options={GRADE_FEEL_OPTIONS} />
    </TextField>
  );
}
