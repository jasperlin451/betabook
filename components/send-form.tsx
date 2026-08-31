"use client";

import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/eyebrow";
import { AscentStyle as AscentStyleChip } from "@/components/ascent-style";
import { useState, useTransition, type ReactNode } from "react";
import {
  Button,
  ButtonGroup,
  Checkbox,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import clsx from "clsx";
import { createSend, updateSend } from "@/db/mutations";
import {
  ASCENT_STYLES,
  GRADE_FEEL_VALUES,
  MAX_COMMENT_LENGTH,
  type AscentStyle,
  type GradeFeel,
} from "@/lib/sends";
import { nativeGradeArray } from "@/lib/grades";
import type { EditableSend, SendableClimb } from "@/db/queries";

type SendFormProps = {
  climb: SendableClimb;
  existingSend?: EditableSend;
  onDone?: () => void;
};

const GRADE_FEEL_LABELS: Record<GradeFeel, string> = {
  low: "Low end",
  solid: "Solid",
  high: "High end",
};

/** The form's three parts, named the way the climb page names its own
 * regions (see Eyebrow): what happened, what you thought of it, anything
 * else. Grouping is the content's own shape, not decoration — the ascent is
 * fact, the rest is opinion, and they get read back differently. */
function FormSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </section>
  );
}

/** Ascent style as the chips the logged send will actually wear, rather
 * than a dropdown of the same three words. Three options is few enough to
 * show at once, and the chip is how this value reads in every feed row and
 * climb page after — so the control shows the row it is about to write.
 *
 * Radio semantics rather than the toggle chips the filters use: those pick a
 * set, this picks exactly one. The chip supplies its own color, so selection
 * is carried by the frame around it and never by tint alone. */
function AscentStylePicker({
  value,
  onChange,
}: {
  value: AscentStyle;
  onChange: (value: AscentStyle) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ascent Style" className="grid grid-cols-3 gap-2">
      {ASCENT_STYLES.map((style) => {
        const selected = value === style;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(style)}
            className={clsx(
              "flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 transition-colors",
              selected ? "border-accent bg-surface" : "border-border hover:border-muted",
            )}
          >
            <AscentStyleChip type={style} />
          </button>
        );
      })}
    </div>
  );
}

export function SendForm({ climb, existingSend, onDone }: SendFormProps) {
  // The user's local calendar date ("en-CA" formats as YYYY-MM-DD) — a UTC
  // date (toISOString) can be a day off from the user's local today.
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const gradeOptions = nativeGradeArray(climb.type);

  const [ascentStyle, setAscentStyle] = useState<AscentStyle>(
    existingSend?.ascentStyle ?? "redpoint",
  );
  const [dateSent, setDateSent] = useState(existingSend?.dateSent ?? today);
  // An undated send has always been representable — the column is nullable
  // and the validator maps blank to null, which is how imports arrive — but
  // the form had no way to say it: an undated send opened on today's date
  // and saving stamped it.
  const [dateUnknown, setDateUnknown] = useState(
    existingSend != null && existingSend.dateSent == null,
  );
  const [comment, setComment] = useState(existingSend?.comment ?? "");
  const [rating, setRating] = useState(
    existingSend?.rating != null ? String(existingSend.rating) : "abstain",
  );
  const [suggestedGrade, setSuggestedGrade] = useState(
    String(existingSend?.suggestedGrade ?? climb.grade ?? 0),
  );
  const [gradeFeel, setGradeFeel] = useState<GradeFeel>(
    existingSend?.gradeFeel ?? "solid",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("ascentStyle", ascentStyle);
    formData.set("dateSent", dateUnknown ? "" : dateSent);
    formData.set("comment", comment);
    formData.set("rating", rating === "abstain" ? "" : rating);
    formData.set("suggestedGrade", suggestedGrade);
    formData.set("gradeFeel", gradeFeel);

    startTransition(async () => {
      const result = existingSend
        ? await updateSend(existingSend.id, formData)
        : await createSend(climb.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
    });
  }

  // gap-6 between sections against gap-3 within one: the grouping only reads
  // if the space between groups beats the space inside them.
  return (
    <form onSubmit={handleSubmit} className={`${SURFACE_CARD_CLASS} gap-6`}>
      <FormSection label="Ascent">
        <AscentStylePicker value={ascentStyle} onChange={setAscentStyle} />

        <TextField>
          <Label>Date Sent</Label>
          {/* Native, deliberately: the platform's own date picker beats
            * anything hand-built here, especially on a phone. */}
          <input
            type="date"
            value={dateSent}
            max={today}
            disabled={dateUnknown}
            onChange={(e) => setDateSent(e.target.value)}
            className={`${FIELD_CLASS} disabled:opacity-60`}
          />
          {/* Disabled rather than cleared, so toggling back doesn't cost the
            * user the date they had already picked. */}
          <Checkbox
            className="mt-2"
            isSelected={dateUnknown}
            onChange={setDateUnknown}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I don&apos;t remember
            </Checkbox.Content>
          </Checkbox>
        </TextField>
      </FormSection>

      <FormSection label="Your opinion">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField>
            <Label>Rating</Label>
            <Select
              aria-label="Rating"
              fullWidth
              selectedKey={rating}
              onSelectionChange={(key) => setRating(String(key))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="abstain">No rating</ListBox.Item>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <ListBox.Item key={n} id={String(n)}>
                      {"★".repeat(n)}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </TextField>

          <TextField>
            <Label>Suggested Grade</Label>
            <Select
              aria-label="Suggested Grade"
              fullWidth
              selectedKey={suggestedGrade}
              onSelectionChange={(key) => setSuggestedGrade(String(key))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox className="max-h-64 overflow-y-auto">
                  {gradeOptions.map((label, i) => (
                    <ListBox.Item key={i} id={String(i)}>
                      {label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </TextField>
        </div>

        <TextField>
          <Label>Grade Feel</Label>
          <ButtonGroup className="w-full">
            {GRADE_FEEL_VALUES.map((value) => (
              <Button
                key={value}
                type="button"
                variant={gradeFeel === value ? undefined : "outline"}
                onPress={() => setGradeFeel(value)}
                className="flex-1"
              >
                {GRADE_FEEL_LABELS[value]}
              </Button>
            ))}
          </ButtonGroup>
        </TextField>
      </FormSection>

      <FormSection label="Notes">
        <TextField value={comment} onChange={setComment}>
          <Label>Comment ({MAX_COMMENT_LENGTH - comment.length} characters left)</Label>
          <TextArea
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="How'd it go?"
            className="bg-surface"
          />
        </TextField>
      </FormSection>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending} fullWidth>
        {existingSend ? "Save Changes" : "Log Send"}
      </Button>
    </form>
  );
}
