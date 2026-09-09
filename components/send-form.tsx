"use client";

import { Button, Checkbox, Label, TextArea, TextField } from "@heroui/react";
import { useState, useTransition } from "react";

import { updateSend } from "@/actions";
import {
  AscentStylePicker,
  FormSection,
  GradeFeelField,
  SuggestedGradeField,
} from "@/components/send-fields";
import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DetailsDisclosure } from "@/components/ui/details-disclosure";
import { FieldHeader } from "@/components/ui/field-support";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { RatingField } from "@/components/ui/rating-field";
import type { EditableSend, SendableClimb } from "@/db/queries";
import { MAX_COMMENT_LENGTH, type AscentStyle, type GradeFeel } from "@/lib/sends";

type SendFormProps = {
  climb: SendableClimb;
  existingSend: EditableSend;
  onDone?: () => void;
};

export function SendForm({ climb, existingSend, onDone }: SendFormProps) {
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  const [ascentStyle, setAscentStyle] = useState<AscentStyle>(existingSend.ascentStyle);
  const [dateSent, setDateSent] = useState(existingSend.dateSent ?? today);
  const [dateUnknown, setDateUnknown] = useState(existingSend.dateSent == null);
  const [comment, setComment] = useState(existingSend.comment ?? "");
  const [rating, setRating] = useState<number | null>(existingSend.rating);
  const [suggestedGrade, setSuggestedGrade] = useState(
    String(existingSend.suggestedGrade ?? climb.grade ?? ""),
  );
  const [gradeFeel, setGradeFeel] = useState<GradeFeel>(existingSend.gradeFeel);
  // Open when the send already records an opinion beyond the defaults, so
  // those values are on screen while being edited.
  const [detailsExpanded, setDetailsExpanded] = useState(
    existingSend.rating != null ||
      existingSend.gradeFeel !== "solid" ||
      (existingSend.suggestedGrade != null && existingSend.suggestedGrade !== climb.grade),
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
      const result = await updateSend(existingSend.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${SURFACE_CARD_CLASS} gap-6`}>
      <FormSection label="Ascent">
        <AscentStylePicker value={ascentStyle} onChange={setAscentStyle} />

        {!dateUnknown && (
          <DatePickerField label="Date sent" value={dateSent} max={today} onChange={setDateSent} />
        )}
        <Checkbox isSelected={dateUnknown} onChange={setDateUnknown}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            I don&apos;t remember the date
          </Checkbox.Content>
        </Checkbox>
      </FormSection>

      <DetailsDisclosure
        title="Your opinion"
        isExpanded={detailsExpanded}
        onExpandedChange={setDetailsExpanded}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <RatingField value={rating} onValueChange={setRating} />
          <SuggestedGradeField
            climbType={climb.type}
            value={suggestedGrade}
            onChange={setSuggestedGrade}
          />
        </div>

        <GradeFeelField value={gradeFeel} onChange={setGradeFeel} />
      </DetailsDisclosure>

      <FormSection label="Send commentary">
        <TextField value={comment} onChange={setComment}>
          <FieldHeader
            usage={{ used: comment.length, limit: MAX_COMMENT_LENGTH, unit: "characters" }}
          >
            <Label>Comment</Label>
            <HelpTooltip label="About Send commentary">
              Uses your Send commentary audience wherever this note appears.
            </HelpTooltip>
          </FieldHeader>
          <TextArea maxLength={MAX_COMMENT_LENGTH} placeholder="How'd it go?" />
        </TextField>
      </FormSection>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending} fullWidth>
        Save changes
      </Button>
    </form>
  );
}
