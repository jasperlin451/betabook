import { describe, expect, it } from "vitest";
import { buildGradeHistogram } from "./grade-histogram";
import type { GradeHistogramRow } from "@/db/queries";

describe("buildGradeHistogram", () => {
  it("returns an empty histogram for no rows", () => {
    const h = buildGradeHistogram([]);
    expect(h.totalClimbs).toBe(0);
    expect(h.boulderBuckets).toEqual([]);
    expect(h.ropeBuckets).toEqual([]);
    expect(h.boulderSpan).toBeNull();
    expect(h.ropeSpan).toBeNull();
    expect(h.disciplines).toEqual([]);
  });

  it("gives boulders one bucket per V grade, contiguous across gaps", () => {
    const rows: GradeHistogramRow[] = [
      { type: "boulder", grade: 1, count: 2 }, // V0
      { type: "boulder", grade: 4, count: 1 }, // V3
    ];
    const h = buildGradeHistogram(rows);
    expect(h.boulderBuckets).toEqual([
      { label: "V0", count: 2 },
      { label: "V1", count: 0 },
      { label: "V2", count: 0 },
      { label: "V3", count: 1 },
    ]);
    expect(h.boulderSpan).toEqual(["V0", "V3"]);
  });

  it("collapses rope letter grades into one bucket per number, stacking sport and trad", () => {
    const rows: GradeHistogramRow[] = [
      { type: "sport", grade: 10, count: 1 }, // 5.10a
      { type: "sport", grade: 13, count: 2 }, // 5.10d
      { type: "trad", grade: 11, count: 3 }, // 5.10b
      { type: "trad", grade: 14, count: 1 }, // 5.11a
    ];
    const h = buildGradeHistogram(rows);
    expect(h.ropeBuckets).toEqual([
      { label: "5.10", sport: 3, trad: 3 },
      { label: "5.11", sport: 0, trad: 1 },
    ]);
    expect(h.ropeSpan).toEqual(["5.10a", "5.11a"]);
  });

  it("footnotes ungraded climbs instead of giving them a bar", () => {
    const rows: GradeHistogramRow[] = [
      { type: "sport", grade: null, count: 4 },
      { type: "sport", grade: 8, count: 1 },
    ];
    const h = buildGradeHistogram(rows);
    expect(h.ungradedCount).toBe(4);
    expect(h.totalClimbs).toBe(5);
    expect(h.ropeBuckets).toEqual([{ label: "5.8", sport: 1, trad: 0 }]);
  });

  it("lists disciplines present in boulder → sport → trad order", () => {
    const rows: GradeHistogramRow[] = [
      { type: "trad", grade: 8, count: 1 },
      { type: "boulder", grade: 3, count: 1 },
    ];
    expect(buildGradeHistogram(rows).disciplines).toEqual(["boulder", "trad"]);
  });

  it("ignores out-of-range grade ordinals rather than crashing the header", () => {
    const rows: GradeHistogramRow[] = [
      { type: "boulder", grade: 99, count: 1 },
      { type: "boulder", grade: 2, count: 1 },
    ];
    const h = buildGradeHistogram(rows);
    expect(h.boulderBuckets).toEqual([{ label: "V1", count: 1 }]);
  });
});
