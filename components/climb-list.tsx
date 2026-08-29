"use client";

import { Chip } from "@heroui/react";
import { describeGradeTrend, formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { ClimbWithAreaName } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";
import { RatingStars } from "@/components/ui/rating-stars";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ClimbSentIndicator } from "@/components/climb-sent-indicator";

// success/warning are reserved for ascent-style chips (AscentStyle), and
// HeroUI's only other built-in tokens are accent/default — too few hues for
// three disciplines that need to read as distinct from each other and from
// gray. Each discipline instead has its own bg/fg custom properties with
// per-theme (light + dark) values, defined in app/globals.css — plain
// utilities referencing them win over the chip's own colors by layer order
// (utilities > components), no `!` needed.
const STYLE_CHIP_CLASSNAME: Record<ClimbType, string> = {
  boulder: "bg-(--discipline-boulder-bg) text-(--discipline-boulder-fg)",
  sport: "bg-(--discipline-sport-bg) text-(--discipline-sport-fg)",
  trad: "bg-(--discipline-trad-bg) text-(--discipline-trad-fg)",
};

type ClimbListProps = {
  climbs: ClimbWithAreaName[];
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
            // The posted grade owns the left margin (guidebook index column);
            // the sent tick sits between grade and name — "ticking the line"
            // right where the route entry starts — so the grade column stays
            // hard against the row edge whether or not a viewer is signed in.
            grade={climb.grade == null ? "—" : formatGrade(climb.type, climb.grade)}
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
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <GradeTrendHint
                    type={climb.type}
                    grade={climb.grade}
                    avgSuggestedGrade={sendStats?.[climb.id]?.avgSuggestedGrade ?? null}
                  />
                  <RatingStars rating={sendStats?.[climb.id]?.avgRating ?? null} precision="decimal" />
                </div>
                <Chip variant="soft" className={`capitalize ${STYLE_CHIP_CLASSNAME[climb.type]}`}>
                  {climb.type}
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

/** The community-divergence half of GradeWithTrend, for rows where the
 * posted grade itself has moved to the leading margin column: renders a
 * muted parenthetical — "(V5↑)" when the average suggested grade rounds a
 * whole step away, "(V4↑)" (the posted grade with just an arrow) when it
 * only leans past the posted grade — or nothing at all when the community
 * average matches the posted grade. */
function GradeTrendHint({
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

  if (suggestedLabel == null && arrowSymbol == null) return null;

  return (
    <span className="text-sm text-muted">
      ({suggestedLabel ?? postedLabel}
      {arrowSymbol})
    </span>
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
