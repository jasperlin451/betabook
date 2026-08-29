import { BOULDER_HUECO, ROPE_YDS, type ClimbType } from "@/lib/grades";
import type { GradeHistogramRow } from "@/db/queries";

/** One histogram bar. Boulder buckets are one V grade each; rope buckets
 * collapse letter grades to the number ("5.10a–d" → "5.10") and stack
 * sport on trad within the bar. */
export type BoulderBucket = { label: string; count: number };
export type RopeBucket = { label: string; sport: number; trad: number };

export type GradeHistogram = {
  totalClimbs: number;
  /** Climbs with no grade — footnoted rather than given a bar. */
  ungradedCount: number;
  /** Disciplines present, in boulder → sport → trad order. */
  disciplines: ClimbType[];
  /** Contiguous from the lowest to highest boulder grade present (zeros
   * between kept, so the histogram shows the real shape). Empty when the
   * subtree has no graded boulders. */
  boulderBuckets: BoulderBucket[];
  /** Same, for rope grades collapsed to their number. */
  ropeBuckets: RopeBucket[];
  /** Native-label span of graded climbs, e.g. ["V0", "V8"] / ["5.6", "5.12a"]. */
  boulderSpan: [string, string] | null;
  ropeSpan: [string, string] | null;
};

/** "5.10a" → "5.10"; grades without a letter pass through. */
function collapseRopeLabel(label: string): string {
  return label.replace(/[a-d]$/, "");
}

/** Buckets the raw (type, grade, count) rows from getSubtreeGradeHistogram
 * into renderable histogram groups plus the info-strip aggregates. Pure —
 * see grade-histogram.test.ts. */
export function buildGradeHistogram(rows: GradeHistogramRow[]): GradeHistogram {
  let totalClimbs = 0;
  let ungradedCount = 0;
  const present = new Set<ClimbType>();

  const boulderCounts = new Map<number, number>();
  const ropeCounts = new Map<number, { sport: number; trad: number }>();

  for (const row of rows) {
    totalClimbs += row.count;
    present.add(row.type);
    if (row.grade == null) {
      ungradedCount += row.count;
      continue;
    }
    if (row.type === "boulder") {
      if (row.grade >= 0 && row.grade < BOULDER_HUECO.length) {
        boulderCounts.set(row.grade, (boulderCounts.get(row.grade) ?? 0) + row.count);
      }
    } else if (row.grade >= 0 && row.grade < ROPE_YDS.length) {
      const entry = ropeCounts.get(row.grade) ?? { sport: 0, trad: 0 };
      entry[row.type] += row.count;
      ropeCounts.set(row.grade, entry);
    }
  }

  const boulderBuckets: BoulderBucket[] = [];
  let boulderSpan: [string, string] | null = null;
  if (boulderCounts.size > 0) {
    const indices = [...boulderCounts.keys()];
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    for (let i = min; i <= max; i++) {
      boulderBuckets.push({ label: BOULDER_HUECO[i], count: boulderCounts.get(i) ?? 0 });
    }
    boulderSpan = [BOULDER_HUECO[min], BOULDER_HUECO[max]];
  }

  const ropeBuckets: RopeBucket[] = [];
  let ropeSpan: [string, string] | null = null;
  if (ropeCounts.size > 0) {
    const indices = [...ropeCounts.keys()];
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    // Walk grade indices min..max, merging letter grades into one bucket
    // per collapsed label — pushing a new bucket only when the label
    // changes keeps buckets in grade order.
    for (let i = min; i <= max; i++) {
      const label = collapseRopeLabel(ROPE_YDS[i]);
      const counts = ropeCounts.get(i) ?? { sport: 0, trad: 0 };
      const last = ropeBuckets[ropeBuckets.length - 1];
      if (last && last.label === label) {
        last.sport += counts.sport;
        last.trad += counts.trad;
      } else {
        ropeBuckets.push({ label, ...counts });
      }
    }
    ropeSpan = [ROPE_YDS[min], ROPE_YDS[max]];
  }

  const disciplines = (["boulder", "sport", "trad"] as const).filter((d) => present.has(d));

  return {
    totalClimbs,
    ungradedCount,
    disciplines,
    boulderBuckets,
    ropeBuckets,
    boulderSpan,
    ropeSpan,
  };
}
