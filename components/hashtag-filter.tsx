"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { SearchCombobox } from "@/components/ui/search-combobox";
import { normalizeHashtagFilter } from "@/lib/hashtag-filter";

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
        <SearchCombobox
          label={inlineLabel ? undefined : "Hashtag"}
          ariaLabel="Hashtag"
          showSearchIcon={false}
          value={draft}
          onChange={(text) => setDraft(`#${text.replace(/^#+/, "")}`)}
          minimumQueryLength={2}
          protectedPrefixLength={1}
          onInputKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            // Let the combobox select its highlighted suggestion with Enter.
            if (event.key === "Enter" && event.currentTarget.getAttribute("aria-activedescendant"))
              return;
            event.preventDefault();
            event.stopPropagation();
            return commit(draft);
          }}
          fetcher={async () => availableItems}
          browseItems={availableItems}
          scope={JSON.stringify([tags, value])}
          itemKey={(item) => item.tag}
          itemText={(item) => item.tag}
          renderItem={(item) => `#${item.tag}`}
          onSelect={(item) => commit(item.tag)}
          placeholder="#"
          emptyMessage="No matching hashtags."
          description="Enter or Space to select. X to remove."
          fullWidth
        />
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
