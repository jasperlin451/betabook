"use client";

import { Chip, Link } from "@heroui/react";
import { describeGradeTrend } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";
import { RatingStars } from "@/components/ui/rating-stars";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ClimbSentIndicator } from "@/components/climb-sent-indicator";

// success/warning/danger are reserved for ascent-style chips (AscentStyle), and
// HeroUI's only other built-in tokens are accent/default — too few hues for
// three disciplines that need to read as distinct from each other and from
// gray. Overriding background/text directly gives each one its own color.
const STYLE_CHIP_CLASSNAME: Record<ClimbType, string> = {
  boulder: "bg-blue-100! text-blue-700!",
  sport: "bg-violet-100! text-violet-700!",
  trad: "bg-teal-100! text-teal-700!",
};

type ClimbListProps = {
  climbs: (Climb & { areaName?: string })[];
  emptyMessage?: string;
  /** A "load more" button shown at the bottom of the list, in place of
   * numbered pagination — same pattern as the user send list. */
  pagination?: {
    hasNextPage: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
  };
  /** Average rating, logged-ascent count, and average suggested grade per
   * climb, keyed by climb id. */
  sendStats?: Record<
    number,
    { avgRating: number | null; sendCount: number; avgSuggestedGrade: number | null }
  >;
  /** Up to two ancestor areas per climb's area, keyed by area id. */
  areaBreadcrumbs?: Record<number, { id: number; name: string }[]>;
  /** Every climb id the signed-in viewer has ever sent. `undefined` means no
   * signed-in viewer — the leading sent/log-send indicator is omitted
   * entirely rather than showing it for a viewer who couldn't act on it. */
  sentClimbIds?: Set<number>;
};

export function ClimbList({
  climbs,
  emptyMessage = "No climbs found.",
  pagination,
  sendStats,
  areaBreadcrumbs,
  sentClimbIds,
}: ClimbListProps) {
  if (climbs.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  const loadMoreBlock = pagination?.hasNextPage && (
    <LoadMoreButton onPress={pagination.onLoadMore} loading={pagination.loadingMore} />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-separator">
        {climbs.map((climb) => (
          <ListRow
            key={climb.id}
            leading={
              sentClimbIds && (
                <ClimbSentIndicator climb={climb} sent={sentClimbIds.has(climb.id)} />
              )
            }
            title={<Link href={`/climbs/${climb.id}`}>{climb.name}</Link>}
            subtitle={
              <AreaBreadcrumb
                areaId={climb.areaId}
                areaName={climb.areaName ?? ""}
                ancestors={areaBreadcrumbs?.[climb.areaId] ?? []}
              />
            }
            trailing={
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    <GradeWithTrend
                      type={climb.type}
                      grade={climb.grade}
                      avgSuggestedGrade={sendStats?.[climb.id]?.avgSuggestedGrade ?? null}
                    />
                  </span>
                  <span className="text-muted" aria-hidden>
                    •
                  </span>
                  <RatingStars rating={sendStats?.[climb.id]?.avgRating ?? null} precision="decimal" />
                </div>
                <Chip variant="soft" className={STYLE_CHIP_CLASSNAME[climb.type]}>
                  {climb.type.toUpperCase()}
                </Chip>
                <span className="text-muted text-sm">
                  {sendStats?.[climb.id]?.sendCount ?? 0} ascents
                </span>
              </div>
            }
          />
        ))}
      </div>
      {loadMoreBlock}
    </div>
  );
}

export function GradeWithTrend({
  type,
  grade,
  avgSuggestedGrade,
}: {
  type: ClimbType;
  grade: number | null;
  avgSuggestedGrade: number | null;
}) {
  const { postedLabel, suggestedLabel, arrow } = describeGradeTrend(type, grade, avgSuggestedGrade);
  const arrowSymbol = arrow === "up" ? "↑" : arrow === "down" ? "↓" : null;

  if (suggestedLabel == null) {
    return arrowSymbol == null ? (
      <>{postedLabel}</>
    ) : (
      <>
        {postedLabel} {arrowSymbol}
      </>
    );
  }

  return (
    <>
      {postedLabel} ({suggestedLabel}
      {arrowSymbol}
      )
    </>
  );
}
