"use client";

import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import { useState, useTransition } from "react";
import { Button, ButtonGroup, Label, TextArea, TextField } from "@heroui/react";
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

const ASCENT_STYLE_LABELS: Record<AscentStyle, string> = {
  redpoint: "Redpoint",
  flash: "Flash",
  onsight: "Onsight",
};

const GRADE_FEEL_LABELS: Record<GradeFeel, string> = {
  low: "Low end",
  solid: "Solid",
  high: "High end",
};

export function SendForm({ climb, existingSend, onDone }: SendFormProps) {
  // The user's local calendar date ("en-CA" formats as YYYY-MM-DD) — a UTC
  // date (toISOString) can be a day off from the user's local today.
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const gradeOptions = nativeGradeArray(climb.type);

  const [ascentStyle, setAscentStyle] = useState<AscentStyle>(
    existingSend?.ascentStyle ?? "redpoint",
  );
  const [dateSent, setDateSent] = useState(existingSend?.dateSent ?? today);
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
    formData.set("dateSent", dateSent);
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

  return (
    <form
      onSubmit={handleSubmit}
      className={SURFACE_CARD_CLASS}
    >
      <TextField>
        <Label>Ascent Style</Label>
        <select
          value={ascentStyle}
          onChange={(e) => setAscentStyle(e.target.value as AscentStyle)}
          className={FIELD_CLASS}
        >
          {ASCENT_STYLES.map((style) => (
            <option key={style} value={style}>
              {ASCENT_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </TextField>

      <TextField>
        <Label>Date Sent</Label>
        <input
          type="date"
          value={dateSent}
          max={today}
          onChange={(e) => setDateSent(e.target.value)}
          className={FIELD_CLASS}
        />
      </TextField>

      <TextField>
        <Label>Rating</Label>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="abstain">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </TextField>

      <TextField>
        <Label>Suggested Grade</Label>
        <select
          value={suggestedGrade}
          onChange={(e) => setSuggestedGrade(e.target.value)}
          className={FIELD_CLASS}
        >
          {gradeOptions.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>
      </TextField>

      <TextField>
        <Label>Grade Feel</Label>
        <ButtonGroup className="w-full lg:w-auto lg:self-start">
          {GRADE_FEEL_VALUES.map((value) => (
            <Button
              key={value}
              type="button"
              variant={gradeFeel === value ? undefined : "outline"}
              onPress={() => setGradeFeel(value)}
              className="flex-1 lg:flex-none"
            >
              {GRADE_FEEL_LABELS[value]}
            </Button>
          ))}
        </ButtonGroup>
      </TextField>

      <TextField value={comment} onChange={setComment}>
        <Label>
          Comment ({MAX_COMMENT_LENGTH - comment.length} characters left)
        </Label>
        <TextArea
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="How'd it go?"
          className="bg-surface"
        />
      </TextField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending} fullWidth>
        {existingSend ? "Save Changes" : "Log Send"}
      </Button>
    </form>
  );
}
