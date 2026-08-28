"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import type { Climb, SendWithUserName } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { AscentStyle } from "@/components/ascent-style";
import { RatingStars } from "@/components/ui/rating-stars";
import { ListRow } from "@/components/ui/list-row";
import { SendListShell } from "@/components/send-list-shell";
import { SendActionsMenu } from "@/components/send-actions-menu";

type ClimbSendListProps = {
  sends: SendWithUserName[];
  climb: Climb;
  /** The signed-in viewer's own user id, if any — used to show the actions
   * menu on their own row (a user can only have one send per climb). */
  currentUserId?: string | null;
};

/** Community ascents for a single climb — one row per climber. */
export function ClimbSendList({ sends, climb, currentUserId }: ClimbSendListProps) {
  return (
    <SendListShell
      sends={sends}
      renderRow={(send) => (
        <ListRow
          title={<AppLink href={`/users/${send.userId}`}>{send.userName}</AppLink>}
          subtitle={send.dateSent ?? "Date unknown"}
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  {formatGrade(climb.type, send.suggestedGrade)}
                  {send.gradeFeel === "high" && (
                    <ArrowUp className="size-3.5 text-muted" aria-label="High end of the grade" />
                  )}
                  {send.gradeFeel === "low" && (
                    <ArrowDown className="size-3.5 text-muted" aria-label="Low end of the grade" />
                  )}
                </span>
                <span className="text-muted" aria-hidden>
                  •
                </span>
                <RatingStars rating={send.rating} />
              </div>
              <AscentStyle type={send.ascentStyle} />
            </div>
          }
          actions={
            send.userId === currentUserId && <SendActionsMenu climb={climb} send={send} />
          }
          comment={send.comment}
        />
      )}
    />
  );
}
