"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { HashtagFilter } from "@/components/hashtag-filter";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import { normalizeHashtagFilters } from "@/lib/hashtag-filter";

export function AnalyticsHashtagFilter({
  selectedTags,
  tags,
}: {
  selectedTags: string[];
  tags: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filter, setFilter } = useFilterFormNavigation({
    initialFilter: selectedTags,
    defaultFilter: [],
    buildHref: (value) => {
      const query = new URLSearchParams(searchParams);
      query.delete("tag");
      for (const tag of normalizeHashtagFilters(value)) query.append("tag", tag);
      return `${pathname}?${query}`;
    },
  });
  return <HashtagFilter value={filter} onChange={setFilter} tags={tags} />;
}
