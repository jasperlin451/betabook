"use client";

import { AppLink } from "@/components/ui/app-link";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { usePagedList } from "@/hooks/use-paged-list";
import { formatGrade } from "@/lib/grades";
import type { PublicClimbsPage } from "@/lib/public-catalog";
import { climbHref } from "@/lib/slug";

export function PublicClimbList({
  initial,
  areaId,
  query,
}: {
  initial: PublicClimbsPage;
  areaId: number;
  query: string;
}) {
  const list = usePagedList({
    initialItems: initial.climbs,
    initialHasMore: initial.hasNextPage,
    initialMeta: initial.areaBreadcrumbs,
    itemKey: (climb) => climb.id,
    mergeMeta: (current, incoming) => ({ ...current, ...incoming }),
    fetchPage: async (offset, _page, _last, signal) => {
      const params = new URLSearchParams(query);
      params.set("offset", String(offset));
      const response = await fetch(`/api/public/areas/${areaId}/climbs?${params}`, { signal });
      if (!response.ok) throw new Error("Could not load climbs");
      const page: PublicClimbsPage = await response.json();
      return { items: page.climbs, hasMore: page.hasNextPage, meta: page.areaBreadcrumbs };
    },
  });
  return (
    <div className="flex flex-col gap-3">
      {list.items.length ? (
        <ul className="divide-y divide-separator">
          {list.items.map((climb) => (
            <li key={climb.id}>
              <AppLink
                href={climbHref(climb.id, climb.name)}
                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-foreground no-underline hover:bg-surface-secondary"
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="min-w-0 break-words">{climb.name}</span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <Grade>{formatGrade(climb.type, climb.grade)}</Grade>
                    <DisciplineChip type={climb.type} />
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {[...(list.meta[climb.areaId] ?? []).map((a) => a.name), climb.areaName].join(
                    " / ",
                  )}
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No climbs match in this area." />
      )}
      {list.hasMore && (
        <LoadMoreButton
          onPress={list.loadMore}
          loading={list.loadingMore}
          failed={list.loadMoreFailed}
        />
      )}
    </div>
  );
}
