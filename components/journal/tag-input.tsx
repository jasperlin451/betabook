"use client";

import { Label, TextField } from "@heroui/react";
import { X } from "lucide-react";
import { useState } from "react";

import { FIELD_CLASS } from "@/components/ui/field";
import {
  isValidJournalTag,
  MAX_JOURNAL_TAGS,
  MAX_JOURNAL_TAG_LENGTH,
  normalizeTag,
} from "@/lib/journal";

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const full = value.length >= MAX_JOURNAL_TAGS;

  function commit() {
    const tag = normalizeTag(draft);
    if (!tag || full || value.includes(tag)) {
      setDraft("");
      setTagError(null);
      return;
    }
    if (!isValidJournalTag(tag)) {
      setTagError("Tags can only contain letters, numbers and hyphens.");
      return;
    }
    setDraft("");
    setTagError(null);
    onChange([...value, tag]);
  }

  return (
    <TextField>
      <Label>Tags</Label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove tag ${tag}`}
                className="flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:text-foreground focus-visible:status-focused"
              >
                {tag}
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        aria-label="Add a tag"
        value={draft}
        disabled={full}
        maxLength={MAX_JOURNAL_TAG_LENGTH}
        aria-invalid={tagError ? true : undefined}
        onChange={(e) => {
          const nextDraft = e.target.value;
          if (/\s/.test(nextDraft)) {
            setTagError("Tags can't contain spaces.");
            return;
          }
          setDraft(nextDraft);
          setTagError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={full ? "" : "hangboard, power-endurance…"}
        className={`${FIELD_CLASS} w-full`}
      />
      <p className={`mt-1 text-xs ${tagError ? "text-danger" : "text-muted"}`}>
        {tagError ??
          (full
            ? `That's all ${MAX_JOURNAL_TAGS} tags — remove one to add another.`
            : `Up to ${MAX_JOURNAL_TAGS} tags, ${MAX_JOURNAL_TAG_LENGTH} characters each. Letters, numbers and hyphens only.`)}
      </p>
    </TextField>
  );
}
