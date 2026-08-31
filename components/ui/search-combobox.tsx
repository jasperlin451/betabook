"use client";

import type { ReactNode } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useTypeahead, type TypeaheadFetcher } from "@/hooks/use-typeahead";

export type SearchComboboxProps<T extends object> = {
  value: string;
  onChange: (value: string) => void;
  /** Resolves suggestions for the typed text (see `useTypeahead`). */
  fetcher: TypeaheadFetcher<T>;
  /** What the fetcher is parameterized by, if anything — results settled
   * under one scope are dropped when it changes (see `useTypeahead`). */
  scope?: string;
  /** Stable per-item id — also what `onSelect` is resolved against. */
  itemKey: (item: T) => string;
  /** The item's plain-text identity, for typeahead matching and a11y. */
  itemText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Runs when a suggestion is chosen. Whether that fills the field, binds a
   * value, or navigates is the caller's business — see the field wrappers. */
  onSelect: (item: T) => void;
  /** Visible label; omit for compact placements (a toolbar, the palette) and
   * pass `ariaLabel` instead. */
  label?: string;
  ariaLabel?: string;
  placeholder: string;
  /** Shown when a settled lookup returned nothing. Says what the empty
   * result means for *this* field — a filter still filters on free text, a
   * navigator simply found nothing. */
  emptyMessage: string;
  /** Shown before anything has been typed. */
  idleMessage: string;
  /** Set when the field binds a value (the area picker), left null when it
   * only edits text — a filter has no "current selection" to restore. */
  selectedKey?: string | null;
  isInvalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  inputClassName?: string;
};

/** The one typeahead in the app: a combobox whose suggestions are fetched as
 * you type, wrapping `useTypeahead` (debounce, cancellation, out-of-order
 * discard, failures degrading to plain text) around consistent chrome and a
 * popover that always says which of its three states it's in.
 *
 * Free text is always valid (`allowsCustomValue`). Every field this backs is
 * usable without ever opening the popover — suggestions complete what you're
 * typing, they don't gate it — so a query with no matches still filters, and
 * a lookup that fails is silent rather than blocking.
 *
 * Callers should reach for `RouteSearchField`/`AreaSearchField` rather than
 * this directly; they fix the row layout and the copy per entity, which is
 * what keeps the surfaces recognizably the same control. */
export function SearchCombobox<T extends object>({
  value,
  onChange,
  fetcher,
  scope,
  itemKey,
  itemText,
  renderItem,
  onSelect,
  label,
  ariaLabel,
  placeholder,
  emptyMessage,
  idleMessage,
  selectedKey = null,
  isInvalid,
  fullWidth,
  className,
  inputClassName,
}: SearchComboboxProps<T>) {
  const { items, isPending } = useTypeahead(value, fetcher, { scope });

  return (
    <ComboBox<T>
      aria-label={label ? undefined : ariaLabel}
      allowsCustomValue
      // Load-bearing: suggestions arrive asynchronously after the debounce,
      // so the collection is empty at the moment the input event would open
      // the popover. Without this the menu would never open at all — and the
      // empty state below is what makes that first open informative.
      allowsEmptyCollection
      menuTrigger="input"
      isInvalid={isInvalid}
      fullWidth={fullWidth}
      className={className}
      inputValue={value}
      onInputChange={onChange}
      items={items}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key == null) return;
        const picked = items.find((item) => itemKey(item) === String(key));
        if (picked) onSelect(picked);
      }}
    >
      {label && <Label>{label}</Label>}
      {/* ComboBox.InputGroup's sibling wiring requires exactly its Input +
        * Trigger children — a wrapper, an icon, an InputGroup.Prefix, or a
        * missing trigger all corrupt it. So the magnifier is a themed
        * background image on the input (search-combo-input in globals.css)
        * and the trigger stays in the tree but hidden: typing is what opens
        * the suggestions, and an arrow on an empty field would promise a
        * list that isn't there. */}
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} className={`search-combo-input ${inputClassName ?? ""}`} />
        <ComboBox.Trigger className="hidden" />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-muted">
              {!value.trim() ? idleMessage : isPending ? "Searching…" : emptyMessage}
            </p>
          )}
        >
          {(item: T) => (
            <ListBox.Item id={itemKey(item)} textValue={itemText(item)}>
              {renderItem(item)}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
