"use client";

import { SearchField } from "@heroui/react";
import { X } from "lucide-react";

import { DateFilter } from "@/components/date-filter";
import { AppLink } from "@/components/ui/app-link";
import { choicePillClass } from "@/components/ui/choice-pill";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import { formatDate } from "@/lib/format-date";
import {
  DEFAULT_JOURNAL_FILTER,
  JOURNAL_VIEWS,
  MAX_JOURNAL_QUERY_LENGTH,
  journalFilterToSearchParams,
  type JournalFilter,
  type JournalView,
} from "@/lib/journal-filter";

const VIEW_LABELS: Record<JournalView, string> = {
  all: "All",
  sessions: "Sessions",
  training: "Training",
};

function href(base: string, filter: JournalFilter): string {
  const params = journalFilterToSearchParams(filter);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function JournalFilterToolbar({
  userId,
  filter,
  climbName,
}: {
  userId: string;
  filter: JournalFilter;
  climbName: string | null;
}) {
  const base = `/users/${userId}/journal`;
  const {
    name: query,
    setName: setQuery,
    filter: localFilter,
    setFilter,
  } = useFilterFormNavigation({
    initialFilter: filter,
    initialName: filter.query ?? "",
    defaultFilter: DEFAULT_JOURNAL_FILTER,
    buildHref: (nextFilter, nextQuery) =>
      href(base, { ...nextFilter, query: nextQuery.trim() || null }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          aria-label="Search journal"
          value={query}
          onChange={setQuery}
          className="w-full sm:w-64"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search journal…" maxLength={MAX_JOURNAL_QUERY_LENGTH} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {JOURNAL_VIEWS.map((view) => (
          <AppLink
            key={view}
            href={href(base, { ...filter, view })}
            aria-current={filter.view === view ? "page" : undefined}
            className={choicePillClass(filter.view === view, "bg-foreground text-background")}
          >
            {VIEW_LABELS[view]}
          </AppLink>
        ))}

        {filter.year !== null && (
          <AppLink
            href={href(base, { ...filter, year: null })}
            aria-label={`Clear ${filter.year} year filter`}
            className={`${choicePillClass(true, "bg-surface-secondary text-foreground")} inline-flex items-center gap-1`}
          >
            {filter.year}
            <X className="size-3.5" aria-hidden />
          </AppLink>
        )}
        {(filter.date || filter.dateFrom || filter.dateTo) && (
          <AppLink
            href={href(base, {
              ...filter,
              date: undefined,
              dateFrom: undefined,
              dateTo: undefined,
              datePreset: undefined,
            })}
            className={choicePillClass(true, "bg-surface-secondary text-foreground")}
            aria-label="Clear date filter"
          >
            {filter.date
              ? formatDate(filter.date)
              : `${filter.dateFrom ? formatDate(filter.dateFrom) : "Any time"} – ${filter.dateTo ? formatDate(filter.dateTo) : "Any time"}`}{" "}
            · Clear dates
          </AppLink>
        )}
        {filter.tag && (
          <AppLink
            href={href(base, { ...filter, tag: null })}
            className={`${choicePillClass(true, "bg-surface-secondary text-foreground")} inline-flex items-center gap-1`}
          >
            {filter.tag}
            <X className="size-3.5" aria-label="Clear tag filter" />
          </AppLink>
        )}
        {filter.climbId !== null && (
          <AppLink
            href={href(base, { ...filter, climbId: null })}
            className={`${choicePillClass(true, "bg-surface-secondary text-foreground")} inline-flex items-center gap-1`}
          >
            <span className="max-w-48 truncate">{climbName ?? "Unknown climb"}</span>
            <X className="size-3.5 shrink-0" aria-label="Clear climb filter" />
          </AppLink>
        )}
      </div>
      <DateFilter
        value={localFilter}
        onChange={(dates) => setFilter({ ...localFilter, ...dates, year: null })}
      />
    </div>
  );
}
