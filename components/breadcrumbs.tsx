import { Breadcrumbs } from "@heroui/react";

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

export function AreaBreadcrumbs({ ancestors, current }: AreaBreadcrumbsProps) {
  return (
    <Breadcrumbs>
      {ancestors.map((ancestor, index) => (
        <Breadcrumbs.Item
          key={ancestor.id}
          href={`/areas/${ancestor.id}`}
          className={visibilityClassName(ancestors.length - index)}
        >
          {ancestor.name}
        </Breadcrumbs.Item>
      ))}
      <Breadcrumbs.Item>{current.name}</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
