"use client";

import { Link } from "@heroui/react";
import { formatGrade, type ClimbType } from "@/lib/grades";
import type { SendWithUserName } from "@/db/queries";
import { AscentType } from "@/components/ascent-type";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { SendFilterForm, DEFAULT_CLIMB_SEND_FILTERS, filterClimbSends } from "@/components/send-filter-form";
import { SendListShell } from "@/components/send-list-shell";

type ClimbSendListProps = {
  sends: SendWithUserName[];
  climbType: ClimbType;
};

/** Community ascents for a single climb — one row per climber. */
export function ClimbSendList({ sends, climbType }: ClimbSendListProps) {
  return (
    <SendListShell
      sends={sends}
      defaultFilters={DEFAULT_CLIMB_SEND_FILTERS}
      filterSends={filterClimbSends}
      renderFilterForm={(filters, onChange) => (
        <SendFilterForm context="climb" value={filters} onChange={onChange} />
      )}
      renderRow={(send) => (
        <ListRow
          title={<Link href={`/users/${send.userId}`}>{send.userName}</Link>}
          subtitle={send.dateSent ?? "Date unknown"}
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {formatGrade(climbType, send.suggestedGrade)}
                </span>
                <span className="text-muted" aria-hidden>
                  •
                </span>
                <RatingStars rating={send.rating} />
              </div>
              <AscentType type={send.completionType} />
            </div>
          }
          comment={send.comment}
        />
      )}
    />
  );
}
