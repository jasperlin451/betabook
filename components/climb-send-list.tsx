"use client";

import { Link } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import type { Climb, SendWithUserName } from "@/db/queries";
import { AscentType } from "@/components/ascent-type";
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
          title={<Link href={`/users/${send.userId}`}>{send.userName}</Link>}
          subtitle={send.dateSent ?? "Date unknown"}
          trailing={
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {formatGrade(climb.type, send.suggestedGrade)}
                </span>
                <span className="text-muted" aria-hidden>
                  •
                </span>
                <RatingStars rating={send.rating} />
              </div>
              <AscentType type={send.completionType} />
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
