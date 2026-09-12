"use client";
import type { ReactNode } from "react";

import { AuthCallout } from "@/components/auth-callout";
import { ClimbFilterControls } from "@/components/filters/climb-filter-controls";
import { useSearch } from "@/hooks/use-search";
import type { AreaSelection } from "@/lib/area-selection";
import { DEFAULT_CLIMB_LIST_SORT } from "@/lib/climb-list-sort";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import { withClimbFilterArea } from "@/lib/filters/climb-filter-state";
import { searchHref } from "@/lib/search";
import type { AppSearchResult, SearchFetcher, SearchSnapshot, SearchState } from "@/lib/search";
import { fetchPublicSearchPage, fetchSearchPage } from "@/lib/search-client";

import { QuickSearchDialog, SearchSurface } from "./search-surface";

const ignoreOpenChange = () => {};

/** Real search behavior shared by the app and isolated, network-injected stories. */
export function SearchController({
  state,
  onChange,
  initial,
  fetcher,
  onNavigate,
  onExpand,
  quick = false,
  isOpen = true,
  onOpenChange = ignoreOpenChange,
  suggestedArea,
  renderAction,
  resultHref,
  publicOnly = false,
}: {
  state: SearchState;
  onChange: (state: SearchState) => void;
  initial?: SearchSnapshot;
  fetcher?: SearchFetcher;
  onNavigate: (item: AppSearchResult) => void;
  onExpand: () => void;
  quick?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  suggestedArea?: AreaSelection;
  renderAction?: (item: AppSearchResult) => ReactNode;
  resultHref?: (item: AppSearchResult) => string;
  publicOnly?: boolean;
}) {
  const search = useSearch({
    state,
    initial,
    fetcher: fetcher ?? (publicOnly ? fetchPublicSearchPage : fetchSearchPage),
    enabled: isOpen,
    preview: quick,
    publicOnly,
  });
  const props = {
    query: state.query,
    onQueryChange: (query: string) => onChange({ ...state, query }),
    category: state.category,
    onCategoryChange: (category: SearchState["category"]) =>
      onChange(
        category === state.category
          ? state
          : {
              ...state,
              category,
              area: null,
              filter: DEFAULT_CLIMB_FILTER,
              sort: DEFAULT_CLIMB_LIST_SORT,
            },
      ),
    area: state.area,
    onAreaChange: (area: AreaSelection | null) =>
      onChange(withClimbFilterArea({ ...state, category: area ? "climb" : state.category }, area)),
    suggestedArea,
    sections: search.sections,
    resultHref: resultHref
      ? (item: { id: string }) => {
          const current = search.sections
            .flatMap((section) => section.items)
            .find((result) => result.id === item.id);
          return current ? resultHref(current) : undefined;
        }
      : undefined,
    onRetry: search.retry,
    onViewAll: onExpand,
    onLoadMore: search.loadMore,
    loadingMore: search.loadingMore,
    loadMoreFailed: search.loadMoreFailed,
    onSelect: (item: { id: string }) => {
      const current = search.sections
        .flatMap((section) => (section.status === "ready" ? section.items : []))
        .find((result) => result.id === item.id);
      if (current && !current.disabledReason) onNavigate(current);
    },
    renderAction: renderAction
      ? (item: { id: string }) => {
          const current = search.sections
            .flatMap((section) => section.items)
            .find((result) => result.id === item.id);
          return current ? renderAction(current) : null;
        }
      : undefined,
    memberNotice: publicOnly ? (
      <AuthCallout
        next={searchHref(state)}
        onNavigate={quick ? () => onOpenChange(false) : undefined}
      />
    ) : undefined,
    filters:
      quick || state.category !== "climb" ? undefined : (
        <ClimbFilterControls
          value={state}
          onChange={(next) => onChange({ ...state, ...next })}
          activeFilters={
            state.query
              ? [
                  {
                    id: "query",
                    label: `Search: ${state.query}`,
                    onRemove: () => onChange({ ...state, query: "" }),
                  },
                ]
              : []
          }
          onReset={() =>
            onChange({
              ...state,
              query: "",
              filter: DEFAULT_CLIMB_FILTER,
              area: null,
              sort: DEFAULT_CLIMB_LIST_SORT,
            })
          }
        />
      ),
  };
  return quick ? (
    <QuickSearchDialog {...props} isOpen={isOpen} onOpenChange={onOpenChange} />
  ) : (
    <SearchSurface {...props} />
  );
}
