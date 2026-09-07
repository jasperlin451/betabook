"use client";

import { ComboBox, Description, Input, Label, ListBox } from "@heroui/react";
import { useContext, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ComboBoxStateContext } from "react-aria-components";

import { useTypeahead, type TypeaheadFetcher } from "@/hooks/use-typeahead";

export type SearchComboboxProps<T extends object> = {
  value: string;
  onChange: (value: string) => void;
  /** Resolves suggestions for the typed text (see `useTypeahead`). */
  fetcher: TypeaheadFetcher<T>;
  /** What the fetcher is parameterized by, if anything — results settled
   * under one scope are dropped when it changes (see `useTypeahead`). */
  scope?: string;
  /** Complete local results: browse immediately on click or typing, with no debounce. */
  browseItems?: T[];
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
  /** Set when the field binds a value (the area picker), left null when it
   * only edits text — a filter has no "current selection" to restore. */
  selectedKey?: string | null;
  isInvalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  inputClassName?: string;
  showSearchIcon?: boolean;
  description?: string;
  /** Keep the caret and selection outside an immutable text prefix. */
  protectedPrefixLength?: number;
  /** Ignore a prefilled prefix until the user types searchable text. */
  minimumQueryLength?: number;
  /** Runs before combobox shortcuts, allowing token fields to commit text. Return true to close the menu. */
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => boolean | undefined;
};

function protectPrefix(input: HTMLInputElement, length: number) {
  if (length === 0 || input.selectionStart == null || input.selectionEnd == null) return;
  if (input.selectionStart < length) {
    input.setSelectionRange(
      length,
      Math.max(length, input.selectionEnd),
      input.selectionDirection ?? undefined,
    );
  }
}

function SearchInput({
  placeholder,
  inputClassName,
  showSearchIcon = true,
  protectedPrefixLength,
  onInputKeyDown,
  browsing,
  scope,
}: {
  placeholder: string;
  inputClassName?: string;
  showSearchIcon?: boolean;
  protectedPrefixLength: number;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => boolean | undefined;
  browsing: boolean;
  scope?: string;
}) {
  const state = useContext(ComboBoxStateContext);
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current !== scope) {
      previousScope.current = scope;
      if (browsing) state?.close();
    }
  }, [browsing, scope, state]);

  function openMenu() {
    if (browsing) state?.open(null, "manual");
  }

  return (
    <Input
      placeholder={placeholder}
      className={`${showSearchIcon ? "search-combo-input" : ""} ${inputClassName ?? ""}`}
      onSelect={(event) => protectPrefix(event.currentTarget, protectedPrefixLength)}
      onFocus={(event) => {
        protectPrefix(event.currentTarget, protectedPrefixLength);
      }}
      onPointerUp={(event) => protectPrefix(event.currentTarget, protectedPrefixLength)}
      onClick={(event) => {
        protectPrefix(event.currentTarget, protectedPrefixLength);
        openMenu();
      }}
      onChangeCapture={openMenu}
      onKeyUp={(event) => protectPrefix(event.currentTarget, protectedPrefixLength)}
      onKeyDownCapture={(event) => {
        const input = event.currentTarget;
        protectPrefix(input, protectedPrefixLength);
        // Block native move-to-start while letting the combobox navigate options.
        if (protectedPrefixLength > 0 && event.key === "ArrowUp") event.preventDefault();
        if (
          protectedPrefixLength > 0 &&
          input.selectionStart === protectedPrefixLength &&
          input.selectionEnd === protectedPrefixLength &&
          (event.key === "Backspace" || event.key === "ArrowLeft")
        ) {
          event.preventDefault();
          return;
        }
        if (onInputKeyDown?.(event) === true) state?.close();
      }}
    />
  );
}

/** The one typeahead in the app: a combobox whose suggestions are fetched as
 * you type, wrapping `useTypeahead` (debounce, cancellation, out-of-order
 * discard, failures degrading to plain text) around consistent chrome and a
 * popover showing loading, results, or an empty result for the typed query.
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
  browseItems,
  itemKey,
  itemText,
  renderItem,
  onSelect,
  label,
  ariaLabel,
  placeholder,
  emptyMessage,
  selectedKey = null,
  isInvalid,
  fullWidth,
  className,
  inputClassName,
  showSearchIcon = true,
  description,
  protectedPrefixLength = 0,
  minimumQueryLength = 1,
  onInputKeyDown,
}: SearchComboboxProps<T>) {
  const queryActive = value.trim().length >= minimumQueryLength;
  const browsing = browseItems !== undefined;
  const lookup = useTypeahead(value, fetcher, { scope, enabled: queryActive && !browsing });
  const items = browseItems ?? lookup.items;
  const isPending = !browsing && lookup.isPending;

  return (
    <ComboBox<T>
      aria-label={label ? undefined : ariaLabel}
      allowsCustomValue
      // Load-bearing: suggestions arrive asynchronously after the debounce,
      // so a nonempty query needs its loading/empty menu before results arrive.
      // A cleared query must close it: pickers clear after selection, and the
      // newly inserted chips can move the input while a reopened menu lags behind.
      allowsEmptyCollection={browsing || queryActive}
      menuTrigger={browsing ? "manual" : "input"}
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
        if (picked) {
          onSelect(picked);
        }
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
        <SearchInput
          placeholder={placeholder}
          inputClassName={inputClassName}
          showSearchIcon={showSearchIcon}
          protectedPrefixLength={protectedPrefixLength}
          onInputKeyDown={onInputKeyDown}
          browsing={browsing}
          scope={scope}
        />
        <ComboBox.Trigger className="hidden" />
      </ComboBox.InputGroup>
      {description && <Description>{description}</Description>}
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-muted">
              {isPending ? "Searching…" : emptyMessage}
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
