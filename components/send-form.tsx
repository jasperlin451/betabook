"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  Button,
  buttonVariants,
  Description,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { Radio, RadioGroup } from "react-aria-components";
import { FormError } from "@/components/ui/form-error";
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
  /** Reports whether the form currently differs from its seeded values —
   * lets the wrapping drawer confirm before discarding unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
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

export function SendForm({ climb, existingSend, onDone, onDirtyChange }: SendFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const gradeOptions = nativeGradeArray(climb.type);
  const dateFieldId = useId();

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

  // Current values vs the seeds above — mirrors the useState initializers.
  const isDirty =
    ascentStyle !== (existingSend?.ascentStyle ?? "redpoint") ||
    dateSent !== (existingSend?.dateSent ?? today) ||
    comment !== (existingSend?.comment ?? "") ||
    rating !== (existingSend?.rating != null ? String(existingSend.rating) : "abstain") ||
    suggestedGrade !== String(existingSend?.suggestedGrade ?? climb.grade ?? 0) ||
    gradeFeel !== (existingSend?.gradeFeel ?? "solid");

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <Select
        fullWidth
        selectedKey={ascentStyle}
        onSelectionChange={(key) => setAscentStyle(String(key) as AscentStyle)}
      >
        <Label>Ascent Style</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {ASCENT_STYLES.map((style) => (
              <ListBox.Item key={style} id={style}>
                {ASCENT_STYLE_LABELS[style]}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Kept as a native date input (platform date pickers beat anything we
          could build here) — labeled manually since react-aria's Label only
          wires itself to library inputs. */}
      <div className="flex flex-col gap-1">
        <Label htmlFor={dateFieldId}>Date Sent</Label>
        <input
          id={dateFieldId}
          type="date"
          value={dateSent}
          max={today}
          onChange={(e) => setDateSent(e.target.value)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        />
      </div>

      <Select
        fullWidth
        selectedKey={rating}
        onSelectionChange={(key) => setRating(String(key))}
      >
        <Label>Rating</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="abstain">No rating</ListBox.Item>
            {[1, 2, 3, 4, 5].map((n) => (
              <ListBox.Item key={n} id={String(n)}>
                {String(n)}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        fullWidth
        selectedKey={suggestedGrade}
        onSelectionChange={(key) => setSuggestedGrade(String(key))}
      >
        <Label>Suggested Grade</Label>
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

      {/* A real radio group (one tab stop, arrow-key selection, announced as
          "Grade Feel" with the checked option) that keeps the segmented-button
          look by dressing each react-aria Radio in HeroUI's button classes. */}
      <RadioGroup
        value={gradeFeel}
        onChange={(value) => setGradeFeel(value as GradeFeel)}
        orientation="horizontal"
        className="flex flex-col gap-1"
      >
        <Label>Grade Feel</Label>
        <div className="button-group button-group--horizontal w-full lg:w-auto lg:self-start">
          {GRADE_FEEL_VALUES.map((value) => (
            <Radio
              key={value}
              value={value}
              className={({ isSelected }) =>
                `${buttonVariants({ variant: isSelected ? "primary" : "outline" })} flex-1 lg:flex-none`
              }
            >
              {GRADE_FEEL_LABELS[value]}
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <TextField value={comment} onChange={setComment}>
        <Label>Comment</Label>
        <TextArea
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="How'd it go?"
          className="bg-surface"
        />
        {/* Lives outside the Label so the field's accessible name doesn't
            change on every keystroke; associated via the description slot. */}
        <Description>
          {MAX_COMMENT_LENGTH - comment.length} characters left
        </Description>
      </TextField>

      <FormError>{error}</FormError>

      <Button type="submit" isDisabled={pending} fullWidth>
        {pending ? "Saving..." : existingSend ? "Save Changes" : "Log Send"}
      </Button>
    </form>
  );
}
