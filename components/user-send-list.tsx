"use client";

import { Link } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import type { SendWithClimb } from "@/db/queries";
import { AscentType } from "@/components/ascent-type";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { SendFilterForm, DEFAULT_USER_SEND_FILTERS, filterUserSends } from "@/components/send-filter-form";
import { SendListShell } from "@/components/send-list-shell";

function AreaBreadcrumb({
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

type UserSendListProps = {
  sends: SendWithClimb[];
  /** Up to two ancestor areas per climb's area, keyed by areaId, for a short
   * breadcrumb next to each send. */
  areaBreadcrumbs: Record<number, { id: number; name: string }[]>;
};

/** A user's full send history — one row per climb they've logged. */
export function UserSendList({ sends, areaBreadcrumbs }: UserSendListProps) {
  return (
    <SendListShell
      sends={sends}
      defaultFilters={DEFAULT_USER_SEND_FILTERS}
      filterSends={filterUserSends}
      renderFilterForm={(filters, onChange) => (
        <SendFilterForm context="user" value={filters} onChange={onChange} />
      )}
      renderRow={(send) => (
        <ListRow
          title={<Link href={`/climbs/${send.climbId}`}>{send.climbName}</Link>}
          subtitle={
            <AreaBreadcrumb
              areaId={send.areaId}
              areaName={send.areaName}
              ancestors={areaBreadcrumbs[send.areaId] ?? []}
            />
          }
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {formatGrade(send.climbType, send.climbGrade)}
                  {send.suggestedGrade != null && send.suggestedGrade !== send.climbGrade && (
                    <span className="font-normal text-muted">
                      {" "}
                      ({formatGrade(send.climbType, send.suggestedGrade)})
                    </span>
                  )}
                </span>
                <span className="text-muted" aria-hidden>
                  •
                </span>
                <RatingStars rating={send.rating} />
              </div>
              <AscentType type={send.completionType} />
              <div className="text-xs text-muted/70">{send.dateSent ?? "Date unknown"}</div>
            </div>
          }
          comment={send.comment}
        />
      )}
    />
  );
}
