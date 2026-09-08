"use client";

import { X } from "lucide-react";

import { DateFilter, DateFilterChip } from "@/components/filters/date-filter";
import { FilterInput } from "@/components/filters/filter-input";
import { FilterToolbarLayout } from "@/components/filters/filter-toolbar";
import { HashtagFilter } from "@/components/filters/hashtag-filter";
import { AppLink } from "@/components/ui/app-link";
import { choicePillClass } from "@/components/ui/choice-pill";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  DEFAULT_JOURNAL_FILTER,
  JOURNAL_VIEWS,
  MAX_JOURNAL_QUERY_LENGTH,
  journalFilterToSearchParams,
  type JournalFilter,
  type JournalView,
} from "@/lib/filters/journal-filter";

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
  tags,
}: {
  userId: string;
  filter: JournalFilter;
  climbName: string | null;
  tags: string[];
}) {
  const base = `/users/${userId}/journal`;
  const {
    filter: localFilter,
    setFilter,
    reset,
  } = useFilterFormNavigation({
    initialFilter: filter,
    defaultFilter: DEFAULT_JOURNAL_FILTER,
    buildHref: (value) => href(base, { ...value, query: value.query?.trim() || null }),
  });

  return (
    <FilterToolbarLayout
      onReset={reset}
      filters={
        <>
          <DateFilter
            value={localFilter}
            onChange={(dates) => setFilter({ ...localFilter, ...dates, year: null })}
          />
          <HashtagFilter
            inlineLabel
            value={localFilter.tags}
            tags={tags}
            onChange={(tags) => setFilter({ ...localFilter, tags })}
          />
        </>
      }
      textFilter={
        <div className="w-full sm:w-64">
          <FilterInput
            label="Filter journal"
            value={localFilter.query ?? ""}
            onChange={(query) => setFilter({ ...localFilter, query: query.trim() ? query : null })}
            placeholder="Filter journal…"
            inputProps={{ maxLength: MAX_JOURNAL_QUERY_LENGTH }}
          />
        </div>
      }
      activeFilters={
        <>
          {filter.year !== null && (
            <AppLink
              href={href(base, { ...localFilter, year: null })}
              aria-label={`Clear ${filter.year} year filter`}
              className={`${choicePillClass(true, "bg-surface-secondary text-foreground")} inline-flex items-center gap-1`}
            >
              {filter.year}
              <X className="size-3.5" aria-hidden />
            </AppLink>
          )}
          <DateFilterChip
            value={filter}
            clearHref={href(base, {
              ...localFilter,
              date: undefined,
              dateFrom: undefined,
              dateTo: undefined,
              datePreset: undefined,
            })}
          />
          {filter.climbId !== null && (
            <AppLink
              href={href(base, { ...localFilter, climbId: null })}
              className={`${choicePillClass(true, "bg-surface-secondary text-foreground")} inline-flex items-center gap-1`}
            >
              <span className="max-w-48 truncate">{climbName ?? "Unknown climb"}</span>
              <X className="size-3.5 shrink-0" aria-label="Clear climb filter" />
            </AppLink>
          )}
        </>
      }
      controls={
        <>
          {JOURNAL_VIEWS.map((view) => (
            <AppLink
              key={view}
              href={href(base, { ...localFilter, view })}
              aria-current={filter.view === view ? "page" : undefined}
              className={choicePillClass(filter.view === view, "bg-foreground text-background")}
            >
              {VIEW_LABELS[view]}
            </AppLink>
          ))}
        </>
      }
    />
  );
}
