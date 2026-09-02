"use client";

import { useCallback } from "react";

import { SearchCombobox } from "@/components/ui/search-combobox";
import { fetchAreaSuggestions, type AreaSuggestion } from "@/lib/search-suggestions";

/** One area suggestion row — the area, with its ancestors underneath to tell
 * same-named crags apart. Exported so the command palette renders areas
 * exactly the way the inline fields do. */
export function AreaSuggestionRow({ area }: { area: AreaSuggestion }) {
  return (
    <span className="min-w-0">
      <p className="truncate">{area.name}</p>
      {area.ancestorPath && <p className="truncate text-xs text-muted">{area.ancestorPath}</p>}
    </span>
  );
}

/** Area search, wherever an area is named — a filter scope, a search field,
 * or a form's area picker. Areas are a known set, so typing offers real ones
 * rather than leaving the user to guess a spelling.
 *
 * `selectedKey` is what separates the two uses: a form picker binds an area
 * id and passes it, while a filter only edits text and leaves it null. Free
 * text stays valid either way — the filters that back these match ancestor
 * names, so a partial like "squam" keeps working without picking anything. */
export function AreaSearchField({
  value,
  onChange,
  onSelect,
  selectedKey,
  label,
  ariaLabel,
  placeholder = "Search areas…",
  emptyMessage = "No matching areas — the text still filters by area name.",
  isInvalid,
  className,
  inputClassName,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (area: AreaSuggestion) => void;
  selectedKey?: string | null;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  isInvalid?: boolean;
  className?: string;
  inputClassName?: string;
  fullWidth?: boolean;
}) {
  const fetcher = useCallback(
    (query: string, signal: AbortSignal) => fetchAreaSuggestions(query, signal),
    [],
  );

  return (
    <SearchCombobox<AreaSuggestion>
      value={value}
      onChange={onChange}
      fetcher={fetcher}
      itemKey={(area) => String(area.id)}
      itemText={(area) => area.name}
      renderItem={(area) => <AreaSuggestionRow area={area} />}
      onSelect={onSelect}
      selectedKey={selectedKey}
      label={label}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      idleMessage="Type an area name…"
      emptyMessage={emptyMessage}
      isInvalid={isInvalid}
      className={className}
      inputClassName={inputClassName}
      fullWidth={fullWidth}
    />
  );
}
