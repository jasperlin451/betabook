"use client";

import { useState, useTransition } from "react";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { createSend, updateSend } from "@/db/mutations";
import { COMPLETION_TYPES, MAX_COMMENT_LENGTH, type CompletionType } from "@/lib/sends";
import { nativeGradeArray } from "@/lib/grades";
import type { Climb, EditableSend } from "@/db/queries";

type SendFormProps = {
  climb: Climb;
  existingSend?: EditableSend;
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
  const [dateSent, setDateSent] = useState(existingSend?.dateSent ?? today);
  const [comment, setComment] = useState(existingSend?.comment ?? "");
  const [rating, setRating] = useState(
    existingSend?.rating != null ? String(existingSend.rating) : "abstain",
  );
  const [suggestedGrade, setSuggestedGrade] = useState(
    String(existingSend?.suggestedGrade ?? climb.grade ?? 0),
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
      <TextField>
        <Label>Completion Type</Label>
        <select
          value={completionType}
          onChange={(e) => setCompletionType(e.target.value as CompletionType)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        >
          {COMPLETION_TYPES.map((type) => (
            <option key={type} value={type}>
              {COMPLETION_LABELS[type]}
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
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        />
      </TextField>

      <TextField>
        <Label>Rating</Label>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
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
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        >
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

      <Button type="submit" isDisabled={pending} fullWidth>
        {existingSend ? "Save Changes" : "Log Send"}
      </Button>
    </form>
  );
}
