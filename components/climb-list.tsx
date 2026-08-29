"use client";

import type { ReactNode } from "react";
import { describeGradeTrend } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import { formatCount } from "@/lib/format";
import type { ClimbWithAreaName } from "@/db/queries";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { GradeBox } from "@/components/ui/grade-box";
import { ListRow } from "@/components/ui/list-row";
import { RatingStars } from "@/components/ui/rating-stars";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ClimbSentIndicator } from "@/components/climb-sent-indicator";

type ClimbListProps = {
  climbs: ClimbWithAreaName[];
  emptyMessage?: string;
  /** A "load more" button shown at the bottom of the list, in place of
   * numbered pagination — same pattern as the user send list. */
  pagination?: {
    hasNextPage: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    /** Inline error shown above the button when a page fetch failed — the
     * button itself stays as the retry affordance. */
    error?: ReactNode;
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
    return <EmptyState message={emptyMessage} />;
  }

  const loadMoreBlock = pagination?.hasNextPage && (
    <div className="flex flex-col items-center gap-2">
      {pagination.error}
      <LoadMoreButton onPress={pagination.onLoadMore} loading={pagination.loadingMore} />
    </div>
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
            title={climb.name}
            href={`/climbs/${climb.id}`}
            subtitle={
              <AreaBreadcrumb
                areaId={climb.areaId}
                areaName={climb.areaName}
                ancestors={areaBreadcrumbs?.[climb.areaId] ?? []}
              />
            }
            trailing={
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <GradeBox>
                    <GradeWithTrend
                      type={climb.type}
                      grade={climb.grade}
                      avgSuggestedGrade={sendStats?.[climb.id]?.avgSuggestedGrade ?? null}
                    />
                  </GradeBox>
                  <RatingStars rating={sendStats?.[climb.id]?.avgRating ?? null} precision="decimal" />
                </div>
                <div className="flex items-center gap-2">
                  <DisciplineChip type={climb.type} />
                  <span className="font-mono text-xs tabular-nums text-muted">
                    {formatCount(sendStats?.[climb.id]?.sendCount ?? 0, "ascent")}
                  </span>
                </div>
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
