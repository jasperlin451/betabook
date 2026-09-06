import { buttonVariants } from "@heroui/react";
import { ExternalLink } from "lucide-react";

import { AscentStyle } from "@/components/ascent-style";
import { AppLink } from "@/components/ui/app-link";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { FeedDay } from "@/db/queries";
import type { FeedView } from "@/lib/feed";
import { formatCount } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { formatGrade } from "@/lib/grades";
import { areaHref, climbHref } from "@/lib/slug";

const ACTIVITY_LABELS = {
  send: "Sent",
  repeat: "Repeated",
  session: "Climbed on",
  training: "Training",
};

export function FeedDayCard({ day, view }: { day: FeedDay; view: FeedView }) {
  const summary = [
    day.sends && formatCount(day.sends, "send"),
    day.repeats && formatCount(day.repeats, "repeat"),
    day.sessions && formatCount(day.sessions, "session"),
    day.training && formatCount(day.training, "training entry", "training entries"),
  ]
    .filter(Boolean)
    .join(" · ");
  const detail = `/users/${day.userId}/${view === "all" && day.journalVisible ? "journal" : "sends"}?date=${day.date}`;
  return (
    <article className="overflow-hidden rounded-lg border border-separator bg-surface">
      <header className="flex items-center gap-3 border-b border-separator px-4 py-4">
        <UserAvatar name={day.name} image={day.image} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            <AppLink href={`/users/${day.userId}`}>{day.name}</AppLink>
          </h2>
          <p className="text-sm text-muted">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-start">
          <time dateTime={day.date} className="text-xs text-muted">
            {formatDate(day.date)}
          </time>
          <AppLink
            href={detail}
            aria-label={`View activity for ${day.name} on ${formatDate(day.date)}`}
            title="View this day"
            className={buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true })}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </AppLink>
        </div>
      </header>
      <div className="divide-y divide-separator">
        {day.activities.map((activity) => (
          <ListRow
            key={`${activity.kind}:${activity.id}`}
            title={activity.climbName ?? "Training"}
            href={
              activity.climbId && activity.climbName
                ? climbHref(activity.climbId, activity.climbName)
                : undefined
            }
            subtitle={
              <span>
                {ACTIVITY_LABELS[activity.kind]}
                {activity.areaId && activity.areaName ? (
                  <>
                    {" "}
                    ·{" "}
                    <AppLink href={areaHref(activity.areaId, activity.areaName)}>
                      {activity.areaName}
                    </AppLink>
                  </>
                ) : null}
              </span>
            }
            trailing={
              activity.climbType && (
                <div className="flex flex-col items-end gap-1">
                  <Grade>{formatGrade(activity.climbType, activity.climbGrade)}</Grade>
                  {activity.ascentStyle && <AscentStyle type={activity.ascentStyle} />}
                </div>
              )
            }
            comment={activity.body}
          />
        ))}
      </div>
    </article>
  );
}
