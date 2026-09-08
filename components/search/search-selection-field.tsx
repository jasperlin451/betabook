"use client";

import { Button, ComboBox, Input, Label, ListBox } from "@heroui/react";

import { FIELD_WIDTH_CLASS } from "@/components/ui/field";

import { SearchResultContent } from "./search-results";
import type { SearchResult, SearchStatus } from "./search-types";

/** Lookup results are supplied by the caller; free text never selects an ID. */
export function SearchSelectionField({
  label,
  hideLabel = false,
  placeholder,
  query,
  onQueryChange,
  items,
  status,
  selectedId = null,
  onSelect,
  onRetry,
  isInvalid = false,
  isDisabled = false,
  emptyMessage = "No matches.",
  errorMessage,
}: {
  emptyMessage?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  label: string;
  hideLabel?: boolean;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  items: SearchResult[];
  status: SearchStatus;
  selectedId?: string | null;
  onSelect: (item: SearchResult) => void;
  onRetry: () => void;
}) {
  return (
    <div className={`${FIELD_WIDTH_CLASS.long} flex flex-col gap-2`}>
      <ComboBox
        aria-label={hideLabel ? label : undefined}
        isInvalid={isInvalid}
        isDisabled={isDisabled}
        inputValue={query}
        onInputChange={onQueryChange}
        selectedKey={selectedId}
        items={items}
        disabledKeys={items
          .filter((item) => status !== "ready" || item.disabledReason)
          .map((item) => item.id)}
        allowsCustomValue
        allowsEmptyCollection={query.trim().length > 0}
        menuTrigger="input"
        fullWidth
        onSelectionChange={(key) => {
          const item = items.find((item) => item.id === key);
          if (item && status === "ready" && !item.disabledReason) onSelect(item);
        }}
      >
        {!hideLabel && <Label>{label}</Label>}
        <ComboBox.InputGroup>
          <Input
            placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
            className="search-combo-input"
          />
          <ComboBox.Trigger className="hidden" />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() => (
              <p role="status" className="px-3 py-2 text-sm text-muted">
                {status === "loading"
                  ? "Searching…"
                  : status === "error"
                    ? "Search unavailable."
                    : emptyMessage}
              </p>
            )}
          >
            {(item: SearchResult) => (
              <ListBox.Item
                id={item.id}
                textValue={item.name}
                aria-label={item.kind === "climber" ? item.name : undefined}
              >
                <span className="flex w-full min-w-0 items-center gap-3">
                  <SearchResultContent item={item} picking />
                </span>
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      {status === "error" && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-danger">
            {errorMessage ?? `Couldn’t load ${label.toLowerCase()}.`}
          </p>
          <Button variant="ghost" size="sm" onPress={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
