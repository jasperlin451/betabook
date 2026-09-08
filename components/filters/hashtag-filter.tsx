"use client";

import { ComboBox, Description, Input, Label, ListBox } from "@heroui/react";
import { X } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { ComboBoxStateContext } from "react-aria-components";

import { normalizeHashtagFilter } from "@/lib/filters/hashtag-filter";

export function HashtagFilter({
  value,
  onChange,
  tags,
  inlineLabel = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  tags: string[];
  inlineLabel?: boolean;
}) {
  const [draft, setDraft] = useState("#");
  const fingerprint = JSON.stringify(value);
  const [previousValue, setPreviousValue] = useState(fingerprint);
  if (previousValue !== fingerprint) {
    setPreviousValue(fingerprint);
    setDraft("#");
  }

  const availableItems = tags
    .filter((tag) => !value.includes(tag) && tag.startsWith(normalizeHashtagFilter(draft)))
    .map((tag) => ({ tag }));

  function commit(text: string) {
    const tag = normalizeHashtagFilter(text);
    if (!tags.includes(tag)) return false;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft("#");
    return true;
  }

  return (
    <div
      className={
        inlineLabel
          ? "grid w-full items-start gap-3 sm:grid-cols-[5rem_16rem]"
          : "flex w-full flex-col gap-2 sm:w-64"
      }
    >
      {inlineLabel && <span className="text-sm font-medium text-foreground sm:pt-2">Hashtag</span>}
      <div className="flex min-w-0 flex-col gap-2">
        <ComboBox
          aria-label={inlineLabel ? "Hashtag" : undefined}
          allowsCustomValue
          allowsEmptyCollection
          menuTrigger="manual"
          inputValue={draft}
          onInputChange={(text) => setDraft(`#${text.replace(/^#+/, "")}`)}
          items={availableItems}
          selectedKey={null}
          fullWidth
          onSelectionChange={(key) => {
            const item = availableItems.find((item) => item.tag === key);
            if (item) commit(item.tag);
          }}
        >
          {!inlineLabel && <Label>Hashtag</Label>}
          <ComboBox.InputGroup>
            <HashtagInput scope={JSON.stringify([tags, value])} onCommit={() => commit(draft)} />
            <ComboBox.Trigger className="hidden" />
          </ComboBox.InputGroup>
          <Description>Enter or Space to select. X to remove.</Description>
          <ComboBox.Popover>
            <ListBox
              renderEmptyState={() => (
                <p className="px-3 py-2 text-sm text-muted">No matching hashtags.</p>
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
                aria-label={`Remove hashtag ${tag}`}
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
function HashtagInput({ scope, onCommit }: { scope: string; onCommit: () => boolean }) {
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
    state?.open(null, "manual");
  }
  return (
    <Input
      placeholder="#"
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
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.key === "Enter" && input.getAttribute("aria-activedescendant")) return;
        event.preventDefault();
        event.stopPropagation();
        if (onCommit()) state?.close();
      }}
    />
  );
}
