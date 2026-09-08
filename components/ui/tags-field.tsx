"use client";

import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { X } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { ComboBoxStateContext } from "react-aria-components";

import { FIELD_WIDTH_CLASS, FILTER_ROW_CLASS, FILTER_LABEL_CLASS } from "@/components/ui/field";
import { FieldHeader, FieldFeedback } from "@/components/ui/field-support";

const EMPTY_TAGS: string[] = [];

export function TagsField({
  value,
  onChange,
  tags = EMPTY_TAGS,
  inlineLabel = false,
  allowCreate = false,
  validateTag,
  maxTags,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  tags?: string[];
  allowCreate?: boolean;
  validateTag?: (tag: string) => string | null;
  maxTags?: number;
  inlineLabel?: boolean;
}) {
  const [draft, setDraft] = useState("#");
  const [error, setError] = useState<string | null>(null);
  const full = maxTags !== undefined && value.length >= maxTags;
  const normalize = (text: string) => text.trim().replace(/^#+/, "").toLowerCase();
  const fingerprint = JSON.stringify(value);
  const [previousValue, setPreviousValue] = useState(fingerprint);
  if (previousValue !== fingerprint) {
    setPreviousValue(fingerprint);
    setDraft("#");
    setError(null);
  }

  const availableItems = tags
    .filter((tag) => !value.includes(tag) && tag.startsWith(normalize(draft)))
    .map((tag) => ({ tag }));

  function commit(text: string) {
    const tag = normalize(text);
    if (!tag || full) return false;
    if (!allowCreate && !tags.includes(tag)) return false;
    const validation = validateTag?.(tag);
    if (validation) {
      setError(validation);
      return false;
    }
    if (!value.includes(tag)) onChange([...value, tag]);
    setError(null);
    setDraft("#");
    return true;
  }

  return (
    <div
      className={inlineLabel ? FILTER_ROW_CLASS : `${FIELD_WIDTH_CLASS.medium} flex flex-col gap-2`}
    >
      {inlineLabel && <span className={FILTER_LABEL_CLASS}>Tags</span>}
      <div className={`${FIELD_WIDTH_CLASS.medium} flex flex-col gap-2`}>
        <ComboBox
          aria-label={inlineLabel ? "Tags" : undefined}
          isDisabled={full}
          isInvalid={Boolean(error)}
          allowsCustomValue
          allowsEmptyCollection
          menuTrigger="manual"
          inputValue={draft}
          onInputChange={(text) => {
            setDraft(`#${text.replace(/^#+/, "")}`);
            setError(null);
          }}
          items={availableItems}
          selectedKey={null}
          fullWidth
          onSelectionChange={(key) => {
            const item = availableItems.find((item) => item.tag === key);
            if (item) commit(item.tag);
          }}
        >
          {!inlineLabel && (
            <FieldHeader
              usage={
                maxTags === undefined
                  ? undefined
                  : { used: value.length, limit: maxTags, unit: "tags" }
              }
            >
              <Label>Tags</Label>
            </FieldHeader>
          )}
          <ComboBox.InputGroup>
            <TagFieldInput
              browse={!allowCreate}
              onBlurCommit={allowCreate ? () => commit(draft) : undefined}
              scope={JSON.stringify([tags, value])}
              onCommit={() => commit(draft)}
            />
            <ComboBox.Trigger className="hidden" />
          </ComboBox.InputGroup>
          <FieldFeedback
            error={error}
            helper={
              full
                ? `That's all ${maxTags} tags — remove one to add another.`
                : "Enter, Space, or comma to add."
            }
          />
          <ComboBox.Popover>
            <ListBox
              renderEmptyState={() => (
                <p className="px-3 py-2 text-sm text-muted">No matching tags.</p>
              )}
            >
              {(item: { tag: string }) => (
                <ListBox.Item id={item.tag} textValue={item.tag}>
                  #{item.tag}
                </ListBox.Item>
              )}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  onChange(value.filter((selected) => selected !== tag));
                  setDraft("#");
                }}
                aria-label={`Remove tag ${tag}`}
                className="flex cursor-pointer items-center gap-1 self-start rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:text-foreground focus-visible:status-focused"
              >
                #{tag}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Browses the supplied filter options immediately; this never performs a record search. */
function TagFieldInput({
  scope,
  onCommit,
  browse,
  onBlurCommit,
}: {
  scope: string;
  onCommit: () => boolean;
  browse: boolean;
  onBlurCommit?: () => void;
}) {
  const state = useContext(ComboBoxStateContext);
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current !== scope) {
      previousScope.current = scope;
      state?.close();
    }
  }, [scope, state]);
  function protectPrefix(input: HTMLInputElement) {
    if (input.selectionStart == null || input.selectionEnd == null) return;
    if (input.selectionStart < 1)
      input.setSelectionRange(
        1,
        Math.max(1, input.selectionEnd),
        input.selectionDirection ?? undefined,
      );
  }
  function openMenu() {
    if (browse) state?.open(null, "manual");
  }
  return (
    <Input
      placeholder="#"
      onBlur={onBlurCommit}
      onSelect={(event) => protectPrefix(event.currentTarget)}
      onFocus={(event) => protectPrefix(event.currentTarget)}
      onPointerUp={(event) => protectPrefix(event.currentTarget)}
      onClick={(event) => {
        protectPrefix(event.currentTarget);
        openMenu();
      }}
      onChangeCapture={openMenu}
      onKeyUp={(event) => protectPrefix(event.currentTarget)}
      onKeyDownCapture={(event) => {
        const input = event.currentTarget;
        protectPrefix(input);
        if (event.key === "ArrowUp") event.preventDefault();
        if (
          input.selectionStart === 1 &&
          input.selectionEnd === 1 &&
          (event.key === "Backspace" || event.key === "ArrowLeft")
        ) {
          event.preventDefault();
          return;
        }
        if (event.nativeEvent.isComposing) return;
        if (event.key !== "Enter" && event.key !== " " && event.key !== ",") return;
        if (event.key === "Enter" && input.getAttribute("aria-activedescendant")) return;
        event.preventDefault();
        event.stopPropagation();
        if (onCommit()) state?.close();
      }}
    />
  );
}
