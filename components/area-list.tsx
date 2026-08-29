import { buttonVariants, Link } from "@heroui/react";
import type { Area } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";

type AreaListProps = {
  areas: (Area & { ancestorPath?: string | null })[];
  emptyMessage?: string;
  variant?: "card" | "link" | "search";
  /** Up to two nearest ancestors per area, keyed by area id — only
   * meaningful for `variant="search"`. */
  areaBreadcrumbs?: Record<number, { id: number; name: string }[]>;
};

export function AreaList({
  areas,
  emptyMessage = "No areas found.",
  variant = "card",
  areaBreadcrumbs,
}: AreaListProps) {
  if (areas.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  if (variant === "search") {
    return (
      <div className="flex flex-col divide-y divide-separator">
        {areas.map((area, index) => (
          <ListRow
            key={area.id}
            leading={
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
            }
            title={
              // Area names set in the display face give the search results
              // the guidebook-index feel; the size bump to text-lg keeps the
              // condensed face at the same visual presence as the sans
              // titles in other list rows.
              <span className="font-display text-lg font-semibold">{area.name}</span>
            }
            href={`/areas/${area.id}`}
            subtitle={<AreaBreadcrumb ancestors={areaBreadcrumbs?.[area.id] ?? []} />}
          />
        ))}
      </div>
    );
  }

  if (variant === "link") {
    return (
      <div className="flex flex-col gap-3">
        {areas.map((area) => (
          <div key={area.id}>
            <Link href={`/areas/${area.id}`}>{area.name}</Link>
            {area.ancestorPath && (
              <p className="text-muted text-sm">Parent: {area.ancestorPath}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => (
        <Link
          key={area.id}
          href={`/areas/${area.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {area.name}
        </Link>
      ))}
    </div>
  );
}
