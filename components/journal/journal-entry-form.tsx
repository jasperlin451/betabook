"use client";

import { Button, Checkbox, Label, TextArea, TextField } from "@heroui/react";
import { useState, useTransition } from "react";

import { createJournalEntry } from "@/actions";
import { TagInput } from "@/components/journal/tag-input";
import {
  AscentStylePicker,
  FormSection,
  GradeFeelField,
  RatingField,
  SuggestedGradeField,
} from "@/components/send-fields";
import { AppLink } from "@/components/ui/app-link";
import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import type { SendableClimb } from "@/db/queries";
import { MAX_JOURNAL_BODY_LENGTH, describePendingEntry, type JournalKind } from "@/lib/journal";
import type { AscentStyle, GradeFeel } from "@/lib/sends";

type JournalEntryFormProps = {
  kind: JournalKind;
  climb?: (SendableClimb & { name: string }) | null;
  hasPriorSend?: boolean;
  onDone?: () => void;
};

export function JournalEntryForm({
  kind,
  climb,
  hasPriorSend = false,
  onDone,
}: JournalEntryFormProps) {
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  const [entryDate, setEntryDate] = useState(today);
  const [sent, setSent] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [ascentStyle, setAscentStyle] = useState<AscentStyle>("redpoint");
  const [rating, setRating] = useState<number | null>(null);
  const [skipRating, setSkipRating] = useState(true);
  const [suggestedGrade, setSuggestedGrade] = useState(String(climb?.grade ?? 0));
  const [gradeFeel, setGradeFeel] = useState<GradeFeel>("solid");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAscent = sent && climb != null && !hasPriorSend;
  const summary = describePendingEntry({ kind, climbName: climb?.name, sent, hasPriorSend });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("entryDate", entryDate);
    formData.set("body", body);
    if (climb) formData.set("climbId", String(climb.id));
    if (sent) formData.set("sent", "true");
    for (const tag of tags) formData.append("tag", tag);

    if (isAscent) {
      formData.set("ascentStyle", ascentStyle);
      formData.set("rating", rating == null ? "" : String(rating));
      formData.set("suggestedGrade", suggestedGrade);
      formData.set("gradeFeel", gradeFeel);
    }

    startTransition(async () => {
      const result = await createJournalEntry(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${SURFACE_CARD_CLASS} gap-6`}>
      <FormSection label="The day">
        <TextField>
          <Label>Date</Label>
          <input
            type="date"
            value={entryDate}
            max={today}
            onChange={(e) => setEntryDate(e.target.value)}
            className={FIELD_CLASS}
          />
        </TextField>

        {climb && (
          <Checkbox isSelected={sent} onChange={setSent}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I sent
            </Checkbox.Content>
          </Checkbox>
        )}
      </FormSection>

      {isAscent && climb && (
        <FormSection label="The ascent">
          <AscentStylePicker value={ascentStyle} onChange={setAscentStyle} />
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
      )}

      <FormSection label="Notes">
        <TextField value={body} onChange={setBody}>
          <Label>{kind === "training" ? "What did you do?" : "How'd it go?"}</Label>
          <TextArea
            maxLength={MAX_JOURNAL_BODY_LENGTH}
            placeholder={
              kind === "training"
                ? "Climbs, drills, sets, weights, how it felt…"
                : "Conditions, beta, how it felt…"
            }
          />
          <p className="mt-1 text-xs text-muted">
            {MAX_JOURNAL_BODY_LENGTH - body.length} characters left
          </p>
        </TextField>

        <TagInput value={tags} onChange={setTags} />
      </FormSection>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary px-4 py-3">
        <p className="text-sm font-medium text-foreground">{summary.headline}</p>
        {summary.consequence && <p className="text-sm text-muted">{summary.consequence}</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" isDisabled={pending} fullWidth>
        Save entry
      </Button>

      <p className="text-center text-xs text-muted">
        Journal visibility is managed in <AppLink href="/account">Account settings</AppLink>.
      </p>
    </form>
  );
}
