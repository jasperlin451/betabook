import { Link } from "@heroui/react";

/** Up to two ancestor areas, then (optionally) the leaf area — each a link.
 * Shared by any row that shows "where" something is: a user's sends and
 * climb search results pass `areaId`/`areaName` to append the leaf, since
 * their row title is the send/climb, not the area itself; area search
 * results omit them (ancestors only), since the row title already links
 * the area itself — appending it here too would just repeat it.
 *
 * Ancestors only have room on desktop — mobile shows just the last segment
 * (the most relevant part), matching the `md:hidden`/`md:` mobile/desktop
 * split already used for the nav (see mobile-nav.tsx). */
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
  const leading = segments.slice(0, -1);
  const last = segments.at(-1);

  if (last == null) return null;

  return (
    <span className="text-xs text-muted">
      {leading.length > 0 && (
        <span className="hidden md:inline">
          {leading.map((segment) => (
            <span key={segment.id}>
              <Link href={`/areas/${segment.id}`} className={linkClassName}>
                {segment.name}
              </Link>
              <span aria-hidden> / </span>
            </span>
          ))}
        </span>
      )}
      <Link href={`/areas/${last.id}`} className={linkClassName}>
        {last.name}
      </Link>
    </span>
  );
}
