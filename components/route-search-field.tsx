"use client";

import { useCallback } from "react";

import { Grade } from "@/components/ui/grade";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { formatGrade } from "@/lib/grades";
import { fetchRouteSuggestions, type RouteSuggestion } from "@/lib/search-suggestions";

/** One route suggestion row — name and grade on the title line, the area
 * underneath. Exported so the command palette renders routes exactly the way
 * the inline fields do. */
export function RouteSuggestionRow({ route }: { route: RouteSuggestion }) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="min-w-0">
        <p className="truncate">{route.name}</p>
        <p className="truncate text-xs text-muted">{route.areaName}</p>
      </span>
      <Grade>{formatGrade(route.type, route.grade)}</Grade>
    </span>
  );
}

/** Route-name search, wherever routes are searched by name. Suggestions and
 * row layout are fixed here; what picking one *does* is the caller's — see
 * the filter/navigator split in the surfaces that render this.
 *
 * With `areaId`, suggestions come from that area's subtree instead of the
 * whole database, so the area page's toolbar offers the routes the page is
 * already about. */
export function RouteSearchField({
  value,
  onChange,
  onSelect,
  areaId,
  label,
  ariaLabel,
  placeholder = "Search routes…",
  emptyMessage = "No matching routes — the text still filters by name.",
  className,
  inputClassName,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (route: RouteSuggestion) => void;
  areaId?: number;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  inputClassName?: string;
  fullWidth?: boolean;
}) {
  const fetcher = useCallback(
    (query: string, signal: AbortSignal) => fetchRouteSuggestions(query, signal, { areaId }),
    [areaId],
  );

  return (
    <SearchCombobox<RouteSuggestion>
      value={value}
      onChange={onChange}
      fetcher={fetcher}
      // Suggestions fetched for one area must not linger when the field is
      // re-pointed at another.
      scope={String(areaId ?? "")}
      itemKey={(route) => String(route.id)}
      itemText={(route) => route.name}
      renderItem={(route) => <RouteSuggestionRow route={route} />}
      onSelect={onSelect}
      label={label}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      idleMessage="Type a route name…"
      emptyMessage={emptyMessage}
      className={className}
      inputClassName={inputClassName}
      fullWidth={fullWidth}
    />
  );
}
