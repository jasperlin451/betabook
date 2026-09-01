"use client";

import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ASCENT_STYLE_CHIP_CLASSNAME, ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { choicePillClass } from "@/components/ui/choice-pill";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Checkbox, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import clsx from "clsx";
import { Star } from "lucide-react";
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

/** Shared with the import wizard's grade-feel value mapping. */
export const GRADE_FEEL_LABELS: Record<GradeFeel, string> = {
  low: "Low end",
  solid: "Solid",
  high: "High end",
};

const GRADE_FEEL_OPTIONS = GRADE_FEEL_VALUES.map((value) => ({
  value,
  label: GRADE_FEEL_LABELS[value],
}));

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

/** Ascent style as the same pills the filter toolbars use, with the chosen
 * one wearing the chip color the logged send will carry in every feed row
 * after — so the control shows the tag it is about to write. Three options
 * is few enough to show at once.
 *
 * Radio semantics rather than the multi-select of the filters: those pick a
 * set, this picks exactly one. */
function AscentStylePicker({
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

const RATING_VALUES = [1, 2, 3, 4, 5];

/** The rating people already picture: five stars, click the one you mean and
 * everything up to it fills. A dropdown of "★★★" strings made you open a menu
 * to say something a row of stars says at a glance — and it read nothing like
 * the RatingStars the send wears afterwards.
 *
 * Radio semantics, same as AscentStylePicker: one value out of five. Hovering
 * previews the fill so the click is never a guess. */
function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  // -ml-1 pulls the first star's hit-area padding back to the column edge, so
  // the row of stars lines up with the fields around it.
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className="-ml-1 flex items-center"
      onMouseLeave={() => setHovered(null)}
    >
      {RATING_VALUES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(null)}
          className="cursor-pointer rounded-md p-1 transition-colors focus-visible:status-focused"
        >
          <Star
            className={clsx(
              "size-7 transition-colors",
              n <= shown ? "fill-current text-warning" : "text-muted",
            )}
          />
        </button>
      ))}
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
  // An existing undated send has to open checked, or saving stamps it with
  // today's date.
  const [dateUnknown, setDateUnknown] = useState(
    existingSend != null && existingSend.dateSent == null,
  );
  const [comment, setComment] = useState(existingSend?.comment ?? "");
  const [rating, setRating] = useState<number | null>(existingSend?.rating ?? null);
  // Opens checked for anything without a rating — a new send, or an existing
  // one saved unrated. Unchecking it only clears the intent to skip; the stars
  // stay empty until you pick one, and an unrated send still saves as null.
  const [skipRating, setSkipRating] = useState(existingSend?.rating == null);
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
    formData.set("rating", rating == null ? "" : String(rating));
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
          <Label>Date sent</Label>
          {/* Native, deliberately: the platform's own date picker beats
            * anything hand-built here, especially on a phone. */}
          <input
            type="date"
            value={dateSent}
            max={today}
            disabled={dateUnknown}
            onChange={(e) => setDateSent(e.target.value)}
            className={FIELD_CLASS}
          />
          {/* Disabled rather than cleared so toggling back keeps the date. */}
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
            <RatingPicker
              value={rating}
              onChange={(value) => {
                setRating(value);
                setSkipRating(false);
              }}
            />
            <Checkbox
              className="mt-2"
              isSelected={skipRating}
              onChange={(selected) => {
                setSkipRating(selected);
                if (selected) setRating(null);
              }}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                Skip rating
              </Checkbox.Content>
            </Checkbox>
          </TextField>

          <TextField>
            <Label>Suggested grade</Label>
            <Select
              aria-label="Suggested grade"
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
          <Label>Grade feel</Label>
          <SegmentedButtons value={gradeFeel} onChange={setGradeFeel} options={GRADE_FEEL_OPTIONS} />
        </TextField>
      </FormSection>

      <FormSection label="Notes">
        <TextField value={comment} onChange={setComment}>
          <Label>Comment</Label>
          <TextArea maxLength={MAX_COMMENT_LENGTH} placeholder="How'd it go?" />
          {/* The count is a helper line, not part of the label: a label
            * names the field, and nothing quietly does two jobs. */}
          <p className="mt-1 text-xs text-muted">
            {MAX_COMMENT_LENGTH - comment.length} characters left
          </p>
        </TextField>
      </FormSection>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending} fullWidth>
        {existingSend ? "Save changes" : "Log send"}
      </Button>
    </form>
  );
}
