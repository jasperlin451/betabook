import { AppLink } from "@/components/ui/app-link";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { Grade } from "@/components/ui/grade";
import { formatDate } from "@/lib/format-date";
import { formatDaySpan, type Breakthrough } from "@/lib/user-analytics";

/** The ceiling register: every send that raised a personal best, newest
 * first — with how long each new ceiling took to reach. */
export function BreakthroughList({
  breakthroughs,
  showDiscipline,
}: {
  breakthroughs: Breakthrough[];
  showDiscipline: boolean;
}) {
  if (breakthroughs.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y divide-separator">
      {breakthroughs.map((breakthrough) => (
        <li
          key={`${breakthrough.type}-${breakthrough.grade}`}
          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <Grade className="w-11 shrink-0">{breakthrough.label}</Grade>
          <div className="min-w-0 flex-1">
            <AppLink
              href={`/climbs/${breakthrough.climbId}`}
              className="block truncate text-sm text-foreground"
            >
              {breakthrough.climbName}
            </AppLink>
          </div>
          {showDiscipline && <DisciplineChip type={breakthrough.type} />}
          <div className="shrink-0 text-right">
            <div className="text-sm text-foreground tabular-nums">
              {formatDate(breakthrough.dateSent)}
            </div>
            <div className="text-xs text-muted">
              {breakthrough.waitDays == null
                ? "first ceiling"
                : `after ${formatDaySpan(breakthrough.waitDays)}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
