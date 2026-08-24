"use client";

import { useRouter } from "next/navigation";
import { Button, Chip, Link, Pagination, useOverlayState } from "@heroui/react";
import { CircleCheck, CirclePlus } from "lucide-react";
import { formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";
import { RatingStars } from "@/components/ui/rating-stars";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { SendFormDrawer } from "@/components/send-form-drawer";

// success/warning/danger are reserved for ascent-type chips (AscentType), and
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
  pagination?: {
    page: number;
    hasNextPage: boolean;
    basePath: string; // e.g. `/areas/12` — page links append `?page=N`
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
  const router = useRouter();

  if (climbs.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  const paginationBlock = pagination && (pagination.page > 1 || pagination.hasNextPage) && (
    <Pagination>
      <Pagination.Content>
        {pagination.page > 1 && (
          <Pagination.Item>
            <Pagination.Previous
              onPress={() =>
                router.push(`${pagination.basePath}?page=${pagination.page - 1}`)
              }
            >
              Previous
            </Pagination.Previous>
          </Pagination.Item>
        )}
        {pagination.hasNextPage && (
          <Pagination.Item>
            <Pagination.Next
              onPress={() =>
                router.push(`${pagination.basePath}?page=${pagination.page + 1}`)
              }
            >
              Next
            </Pagination.Next>
          </Pagination.Item>
        )}
      </Pagination.Content>
    </Pagination>
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
      {paginationBlock}
    </div>
  );
}

/** Leading-slot indicator: a static check if the viewer has already sent
 * this climb, or a compact trigger opening the same create-send drawer used
 * on the climb page (SendFormDrawer via LogSendButton's create-mode usage)
 * if not. Only ever rendered for a signed-in viewer (see `sentClimbIds` on
 * ClimbListProps) — instantiated as a real per-row component, not called as
 * a plain function in `.map()`, so useOverlayState here is a normal
 * one-hook-per-row-component pattern, not a hooks-in-a-loop violation. */
function ClimbSentIndicator({ climb, sent }: { climb: Climb; sent: boolean }) {
  const state = useOverlayState();

  if (sent) {
    return (
      <span
        title="You've sent this climb"
        aria-label="You've sent this climb"
        className="flex size-8 shrink-0 items-center justify-center"
      >
        <CircleCheck className="size-5 text-green-600" aria-hidden />
      </span>
    );
  }

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="Log send"
        onPress={state.open}
        className="shrink-0"
      >
        <CirclePlus className="size-5" />
      </Button>
      <SendFormDrawer climb={climb} state={state} />
    </>
  );
}

/** Posted grade, plus a hint when logged sends' suggested grades diverge from
 * it. The average suggested grade is always compared to *this climb's own*
 * posted grade (never across grading systems) as a step offset: `offset` is
 * the nearest whole grade-step the average centers on, and `remainder` is
 * how far it leans past that — a stand-in for a decimal that wouldn't make
 * sense on a non-numeric scale like "5.10a". A single send always lands
 * exactly on a whole offset with zero remainder, so it can only ever show
 * "matches" or "differs", never a spurious lean — leans only emerge once
 * multiple sends' suggestions genuinely average out to a fractional pull. */
function GradeWithTrend({
  type,
  grade,
  avgSuggestedGrade,
}: {
  type: ClimbType;
  grade: number | null;
  avgSuggestedGrade: number | null;
}) {
  const postedLabel = formatGrade(type, grade);
  if (avgSuggestedGrade == null || grade == null) return <>{postedLabel}</>;

  const delta = avgSuggestedGrade - grade;
  const offset = Math.round(delta);
  const remainder = delta - offset;
  const arrow = Math.abs(remainder) > 0.25 ? (remainder > 0 ? "↑" : "↓") : null;

  if (offset === 0) {
    return arrow == null ? (
      <>{postedLabel}</>
    ) : (
      <>
        {postedLabel} {arrow}
      </>
    );
  }

  const suggestedLabel = formatGrade(type, grade + offset);
  return (
    <>
      {postedLabel} ({suggestedLabel}
      {arrow}
      )
    </>
  );
}
