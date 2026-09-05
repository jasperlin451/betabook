"use client";

import { Button, Checkbox, Input, Label, TextArea, TextField } from "@heroui/react";
import { useEffect, useRef, useState, useTransition } from "react";

import { createJournalEntry, updateJournalEntry } from "@/actions";
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
import type { JournalEntry, SendableClimb } from "@/db/queries";
import { GENERIC_ERROR_MESSAGE } from "@/lib/action-result";
import { MAX_JOURNAL_BODY_LENGTH, type JournalKind, type JournalSaveOutcome } from "@/lib/journal";
import type { AscentStyle, GradeFeel } from "@/lib/sends";

type JournalEntryFormProps = {
  kind: JournalKind;
  climb?: (SendableClimb & { name: string }) | null;
  hasPriorSend?: boolean;
  existingEntry?: JournalEntry;
  onDone?: () => void;
  onCreated?: (outcome: JournalSaveOutcome) => void;
  guided?: boolean;
  onPendingChange?: (pending: boolean) => void;
};

function describePendingEntry(input: {
  kind: JournalKind;
  climbName?: string | null;
  sent: boolean;
  hasPriorSend: boolean;
}): { headline: string; consequence: string | null } {
  if (input.kind === "training") {
    return { headline: "Logging training.", consequence: null };
  }

  const climb = input.climbName?.trim();
  if (!climb) return { headline: "Logging an outdoor session.", consequence: null };

  if (!input.sent) {
    return { headline: `Logging an outdoor session on ${climb}.`, consequence: null };
  }

  if (input.hasPriorSend) {
    return {
      headline: `Logging a repeat of ${climb}.`,
      consequence: `Your ascent of ${climb} is already recorded — a repeat doesn't change it.`,
    };
  }

  return {
    headline: `Logging an ascent of ${climb}.`,
    consequence: `Records a send on ${climb}, counting toward its send total and grade consensus.`,
  };
}

// oxlint-disable-next-line complexity
export function JournalEntryForm({
  kind,
  climb,
  hasPriorSend = false,
  existingEntry,
  onDone,
  onCreated,
  guided = false,
  onPendingChange,
}: JournalEntryFormProps) {
  const dateInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (guided) dateInput.current?.focus();
  }, [guided]);
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  const [entryDate, setEntryDate] = useState(existingEntry?.entryDate ?? today);
  const [sent, setSent] = useState(existingEntry?.sent ?? false);
  const [body, setBody] = useState(existingEntry?.body ?? "");
  const [tags, setTags] = useState<string[]>(existingEntry?.tags ?? []);

  const [ascentStyle, setAscentStyle] = useState<AscentStyle>("redpoint");
  const [rating, setRating] = useState<number | null>(null);
  const [suggestedGrade, setSuggestedGrade] = useState(String(climb?.grade ?? ""));
  const [gradeFeel, setGradeFeel] = useState<GradeFeel>("solid");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAscent = !existingEntry && sent && climb != null && !hasPriorSend;
  const summary = describePendingEntry({ kind, climbName: climb?.name, sent, hasPriorSend });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
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

    onPendingChange?.(true);
    startTransition(async () => {
      try {
        if (existingEntry) {
          const result = await updateJournalEntry(existingEntry.id, formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onDone?.();
        } else {
          const result = await createJournalEntry(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (onCreated) onCreated(result.value);
          else onDone?.();
        }
      } catch {
        setError(GENERIC_ERROR_MESSAGE);
      } finally {
        onPendingChange?.(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${SURFACE_CARD_CLASS} gap-6`}>
      {guided && (
        <p className="text-sm text-muted">
          {kind === "training"
            ? "Record indoor climbing, drills, strength, or conditioning. Add at least a note or a tag before saving."
            : "Log one climb per entry. If you worked on more than one climb that day, add an entry for each."}
        </p>
      )}
      <FormSection label="The day">
        <TextField>
          <Label>Date</Label>
          <Input
            ref={dateInput}
            type="date"
            value={entryDate}
            max={today}
            readOnly={existingEntry?.sent}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </TextField>

        {climb &&
          (existingEntry ? (
            sent && (
              <p className="text-sm text-muted">
                {existingEntry.isAscent
                  ? "To change the ascent date, use Edit send on the climb page."
                  : "To change this repeat’s date, delete the entry and log it again."}
              </p>
            )
          ) : (
            <Checkbox isSelected={sent} onChange={setSent}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                I sent
              </Checkbox.Content>
            </Checkbox>
          ))}
        {guided && climb && !existingEntry && (
          <p className="text-sm text-muted">
            {hasPriorSend
              ? "You've sent this climb before. Select I sent to log a repeat; Sends will keep your original ascent."
              : "Leave I sent unchecked to record work on a project. Select it when you send to also add the ascent to Sends."}
          </p>
        )}
      </FormSection>

      {isAscent && climb && (
        <FormSection label="The ascent">
          <AscentStylePicker value={ascentStyle} onChange={setAscentStyle} />
          <div className="grid gap-4 sm:grid-cols-2">
            <RatingField value={rating} onValueChange={setRating} />
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

        {(isAscent || existingEntry?.isAscent) && (
          <p className="text-xs text-muted">
            This note also appears on your send and follows your profile privacy settings, even if
            your journal is private.
          </p>
        )}
        <TagInput value={tags} onChange={setTags} />
      </FormSection>

      {!existingEntry && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary px-4 py-3">
          <p className="text-sm font-medium text-foreground">{summary.headline}</p>
          {summary.consequence && <p className="text-sm text-muted">{summary.consequence}</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" isDisabled={pending} fullWidth>
        {existingEntry ? "Save changes" : "Save entry"}
      </Button>

      <p className="text-center text-xs text-muted">
        Journal visibility is managed in <AppLink href="/account">Account settings</AppLink>.
      </p>
    </form>
  );
}
