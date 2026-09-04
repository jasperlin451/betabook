"use client";

import { Button, Checkbox, Label, TextArea, TextField } from "@heroui/react";
import { useState, useTransition } from "react";

import { createSend, updateSend } from "@/actions";
import {
  AscentStylePicker,
  FormSection,
  GradeFeelField,
  RatingField,
  SuggestedGradeField,
} from "@/components/send-fields";
import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import type { EditableSend, SendableClimb } from "@/db/queries";
import { MAX_COMMENT_LENGTH, type AscentStyle, type GradeFeel } from "@/lib/sends";

type SendFormProps = {
  climb: SendableClimb;
  existingSend?: EditableSend;
  onDone?: () => void;
};

export function SendForm({ climb, existingSend, onDone }: SendFormProps) {
  // The user's local calendar date ("en-CA" formats as YYYY-MM-DD) — a UTC
  // date (toISOString) can be a day off from the user's local today.
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

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
  const [skipRating, setSkipRating] = useState(existingSend?.rating == null);
  const [suggestedGrade, setSuggestedGrade] = useState(
    String(existingSend?.suggestedGrade ?? climb.grade ?? 0),
  );
  const [gradeFeel, setGradeFeel] = useState<GradeFeel>(existingSend?.gradeFeel ?? "solid");
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
          <Checkbox className="mt-2" isSelected={dateUnknown} onChange={setDateUnknown}>
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
          <RatingField
            value={rating}
            skipped={skipRating}
            onValueChange={setRating}
            onSkippedChange={setSkipRating}
          />
          <SuggestedGradeField
            climbType={climb.type}
            value={suggestedGrade}
            onChange={setSuggestedGrade}
          />
        </div>

        <GradeFeelField value={gradeFeel} onChange={setGradeFeel} />
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
