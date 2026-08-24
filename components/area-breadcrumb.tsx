import { Link } from "@heroui/react";

/** Up to two ancestor areas, then (optionally) the leaf area — each a link.
 * Shared by any row that shows "where" something is: a user's sends and
 * climb search results pass `areaId`/`areaName` to append the leaf, since
 * their row title is the send/climb, not the area itself; area search
 * results omit them (ancestors only), since the row title already links
 * the area itself — appending it here too would just repeat it. */
export function AreaBreadcrumb({
  areaId,
  areaName,
  ancestors,
}: {
  areaId?: number;
  areaName?: string;
  ancestors: { id: number; name: string }[];
}) {
  const linkClassName = "text-xs! font-normal! text-muted!";
  const segments =
    areaId != null && areaName != null ? [...ancestors, { id: areaId, name: areaName }] : ancestors;

  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
      {segments.map((segment, index) => (
        <span key={segment.id} className="flex items-center gap-1">
          <Link href={`/areas/${segment.id}`} className={linkClassName}>
            {segment.name}
          </Link>
          {index < segments.length - 1 && <span aria-hidden>/</span>}
        </span>
      ))}
    </span>
  );
}
