import { Link } from "@heroui/react";

/** Up to two ancestor areas, then the leaf area — each a link. Shared by any
 * row that shows "where" something is (a user's sends, climb search results). */
export function AreaBreadcrumb({
  areaId,
  areaName,
  ancestors,
}: {
  areaId: number;
  areaName: string;
  ancestors: { id: number; name: string }[];
}) {
  const linkClassName = "text-xs! font-normal! text-muted!";

  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
      {ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          <Link href={`/areas/${ancestor.id}`} className={linkClassName}>
            {ancestor.name}
          </Link>
          <span aria-hidden>/</span>
        </span>
      ))}
      <Link href={`/areas/${areaId}`} className={linkClassName}>
        {areaName}
      </Link>
    </span>
  );
}
