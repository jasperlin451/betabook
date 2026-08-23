"use client";

import { useRouter } from "next/navigation";
import { Chip, Link, Pagination, Table } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";
import { RatingStars } from "@/components/ui/rating-stars";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";

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
  variant?: "table" | "search";
  pagination?: {
    page: number;
    hasNextPage: boolean;
    basePath: string; // e.g. `/areas/12` — page links append `?page=N`
  };
  /** Average rating, logged-ascent count, and average suggested grade per
   * climb, keyed by climb id — only meaningful for `variant="search"`. */
  sendStats?: Record<
    number,
    { avgRating: number | null; sendCount: number; avgSuggestedGrade: number | null }
  >;
  /** Up to two ancestor areas per climb's area, keyed by area id — only
   * meaningful for `variant="search"`. */
  areaBreadcrumbs?: Record<number, { id: number; name: string }[]>;
};

export function ClimbList({
  climbs,
  emptyMessage = "No climbs found.",
  variant = "table",
  pagination,
  sendStats,
  areaBreadcrumbs,
}: ClimbListProps) {
  const router = useRouter();

  if (climbs.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  if (variant === "search") {
    return (
      <div className="flex flex-col divide-y divide-separator">
        {climbs.map((climb, index) => (
          <ListRow
            key={climb.id}
            leading={
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
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
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Climbs">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Type</Table.Column>
              <Table.Column>Grade</Table.Column>
            </Table.Header>
            <Table.Body>
              {climbs.map((climb) => (
                <Table.Row key={climb.id} id={climb.id}>
                  <Table.Cell>
                    <Link href={`/climbs/${climb.id}`}>{climb.name}</Link>
                  </Table.Cell>
                  <Table.Cell className="capitalize">{climb.type}</Table.Cell>
                  <Table.Cell>{formatGrade(climb.type, climb.grade)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {pagination && (pagination.page > 1 || pagination.hasNextPage) && (
        <Pagination>
          <Pagination.Content>
            {pagination.page > 1 && (
              <Pagination.Item>
                <Pagination.Previous
                  onPress={() =>
                    router.push(
                      `${pagination.basePath}?page=${pagination.page - 1}`,
                    )
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
                    router.push(
                      `${pagination.basePath}?page=${pagination.page + 1}`,
                    )
                  }
                >
                  Next
                </Pagination.Next>
              </Pagination.Item>
            )}
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
}

/** Posted grade, plus a hint when logged sends' suggested grades diverge from
 * it. Grades are ordinal indices, not numbers you can average and display
 * directly (a fractional rope grade like "5.10a.8" is nonsense) — so the
 * average is floored to a real grade index, and the discarded fraction is
 * shown as a trend arrow instead of a decimal. */
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

  const floored = Math.floor(avgSuggestedGrade);
  const fraction = avgSuggestedGrade - floored;
  const arrow = fraction >= 0.7 ? "↑" : fraction <= 0.3 ? "↓" : null;

  if (floored === grade) {
    return arrow == null ? (
      <>{postedLabel}</>
    ) : (
      <>
        {postedLabel} {arrow}
      </>
    );
  }

  const suggestedLabel = formatGrade(type, floored);
  return (
    <>
      {postedLabel} ({suggestedLabel}
      {arrow}
      )
    </>
  );
}
