"use client";

import { Breadcrumbs } from "@heroui/react";
import { useRouter } from "next/navigation";

import { areaHref } from "@/lib/slug";

type BreadcrumbNamed = { id: number; name: string };

type AreaBreadcrumbsProps = {
  ancestors: BreadcrumbNamed[];
  current: BreadcrumbNamed;
};

/** HeroUI's Breadcrumbs lays items out in one non-wrapping row, so a deep
 * ancestor chain overflows the page on narrow screens. The levels closest
 * to `current` are the most relevant to "where am I right now", so the
 * root-most levels are the first to disappear as the viewport narrows —
 * each level further from `current` needs one more breakpoint to reveal. */
function visibilityClassName(distanceFromCurrent: number): string | undefined {
  if (distanceFromCurrent <= 1) return undefined;
  if (distanceFromCurrent === 2) return "hidden sm:flex";
  if (distanceFromCurrent === 3) return "hidden md:flex";
  return "hidden lg:flex";
}

/** Unlike the list rows (AppLink = next/link, which prefetches itself),
 * these items stay HeroUI/react-aria links — Breadcrumbs.Item owns its inner
 * Link, and its function-children escape hatch drops the separator — so the
 * intent-based prefetch is recreated with router.prefetch on hover/focus.
 * router.prefetch does a full prefetch, matching AppLink's upgrade-on-intent
 * behavior for these (always dynamic) area pages. */
export function AreaBreadcrumbs({ ancestors, current }: AreaBreadcrumbsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      {/* The topo line: a short rope-end leading into the trail of areas,
       * the way a guidebook topo traces a route to its start. */}
      <span className="h-px w-6 shrink-0 bg-palette-primary" aria-hidden />
      <Breadcrumbs>
        {ancestors.map((ancestor, index) => {
          const href = areaHref(ancestor.id, ancestor.name);
          return (
            <Breadcrumbs.Item
              key={ancestor.id}
              href={href}
              onHoverStart={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className={visibilityClassName(ancestors.length - index)}
            >
              {ancestor.name}
            </Breadcrumbs.Item>
          );
        })}
        <Breadcrumbs.Item>{current.name}</Breadcrumbs.Item>
      </Breadcrumbs>
    </div>
  );
}
