"use client";

import { SearchField } from "@heroui/react";
import { X } from "lucide-react";

import { FilterToolbarLayout } from "@/components/filter-toolbar";
import { HashtagFilter } from "@/components/hashtag-filter";
import { AppLink } from "@/components/ui/app-link";
import { choicePillClass } from "@/components/ui/choice-pill";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import { formatDate } from "@/lib/format-date";
import {
  JOURNAL_VIEWS,
  MAX_JOURNAL_QUERY_LENGTH,
  DEFAULT_JOURNAL_FILTER,
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
        <HashtagFilter
          inlineLabel
          value={localFilter.tags}
          tags={tags}
          onChange={(tags) => setFilter({ ...localFilter, tags })}
        />
      }
      controls={
        <>
          <SearchField
            aria-label="Search journal"
            value={localFilter.query ?? ""}
            onChange={(query) => setFilter({ ...localFilter, query: query.trim() ? query : null })}
            className="w-full sm:w-64"
          >
            <SearchField.Group className="h-auto">
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Search journal…"
                maxLength={MAX_JOURNAL_QUERY_LENGTH}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

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
          {filter.date && (
            <AppLink
              href={href(base, { ...localFilter, date: undefined })}
              className={choicePillClass(true, "bg-surface-secondary text-foreground")}
              aria-label="Clear day filter"
            >
              {formatDate(filter.date)} · Clear day
            </AppLink>
          )}
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
    />
  );
}
