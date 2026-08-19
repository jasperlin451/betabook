"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Fieldset,
  Label,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { createSend, updateSend } from "@/db/mutations";
import { COMPLETION_TYPES, MAX_COMMENT_LENGTH, type CompletionType } from "@/lib/sends";
import { nativeGradeArray } from "@/lib/grades";
import type { Climb, Send } from "@/db/queries";

type SendFormProps = {
  climb: Climb;
  existingSend?: Send;
  onDone?: () => void;
};

const COMPLETION_LABELS: Record<CompletionType, string> = {
  redpoint: "Redpoint",
  flash: "Flash",
  onsight: "Onsight",
};

export function SendForm({ climb, existingSend, onDone }: SendFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const gradeOptions = nativeGradeArray(climb.type);

  const [completionType, setCompletionType] = useState<CompletionType>(
    existingSend?.completionType ?? "redpoint",
  );
  const [dateSent, setDateSent] = useState(
    existingSend ? (existingSend.dateSent ?? "") : today,
  );
  const [comment, setComment] = useState(existingSend?.comment ?? "");
  const [rating, setRating] = useState(
    existingSend?.rating != null ? String(existingSend.rating) : "abstain",
  );
  const [suggestedGrade, setSuggestedGrade] = useState(
    existingSend?.suggestedGrade != null
      ? String(existingSend.suggestedGrade)
      : climb.grade != null
        ? String(climb.grade)
        : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("completionType", completionType);
    formData.set("dateSent", dateSent);
    formData.set("comment", comment);
    formData.set("rating", rating === "abstain" ? "" : rating);
    formData.set("suggestedGrade", suggestedGrade);

    startTransition(async () => {
      try {
        if (existingSend) {
          await updateSend(existingSend.id, formData);
        } else {
          await createSend(climb.id, formData);
        }
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <Fieldset>
        <Fieldset.Legend>Completion Type</Fieldset.Legend>
        <RadioGroup
          value={completionType}
          onChange={(value) => setCompletionType(value as CompletionType)}
          className="flex gap-4"
        >
          {COMPLETION_TYPES.map((type) => (
            <Radio key={type} value={type}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {COMPLETION_LABELS[type]}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      </Fieldset>

      <TextField>
        <Label>Date Sent</Label>
        <input
          type="date"
          value={dateSent}
          max={today}
          onChange={(e) => setDateSent(e.target.value)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        />
      </TextField>

      <Fieldset>
        <Fieldset.Legend>Rating</Fieldset.Legend>
        <RadioGroup value={rating} onChange={setRating} className="flex flex-wrap gap-4">
          <Radio value="abstain">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              No rating
            </Radio.Content>
          </Radio>
          {[1, 2, 3, 4, 5].map((n) => (
            <Radio key={n} value={String(n)}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {n}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      </Fieldset>

      <TextField>
        <Label>Suggested Grade</Label>
        <select
          value={suggestedGrade}
          onChange={(e) => setSuggestedGrade(e.target.value)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        >
          <option value="">Unknown</option>
          {gradeOptions.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>
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

      <Button type="submit" isDisabled={pending}>
        {existingSend ? "Save Changes" : "Log Send"}
      </Button>
    </form>
  );
}
