import { describe, expect, it } from "vitest";
import {
  buildPyramid,
  buildUserAnalytics,
  formatDaySpan,
  parseDisciplineScope,
} from "./user-analytics";
import type { AnalyticsSendRow } from "@/db/queries";

let nextClimbId = 1;
function send(over: Partial<AnalyticsSendRow>): AnalyticsSendRow {
  return {
    climbId: nextClimbId++,
    climbName: "Some Climb",
    climbType: "boulder",
    climbGrade: 3,
    areaId: 1,
    areaName: "Forestland",
    ascentStyle: "redpoint",
    dateSent: "2024-03-10",
    ...over,
  };
}

describe("parseDisciplineScope", () => {
  it("accepts the three disciplines and falls back to all", () => {
    expect(parseDisciplineScope("sport")).toBe("sport");
    expect(parseDisciplineScope("alpine")).toBe("all");
    expect(parseDisciplineScope(undefined)).toBe("all");
  });
});

describe("formatDaySpan", () => {
  it("scales units with the gap", () => {
    expect(formatDaySpan(0)).toBe("same day");
    expect(formatDaySpan(12)).toBe("12d");
    expect(formatDaySpan(120)).toBe("4 mo");
    expect(formatDaySpan(800)).toBe("2.2 yr");
  });
});

describe("buildPyramid", () => {
  it("builds from any slice, ignoring other disciplines and bad grades", () => {
    const rows = buildPyramid(
      [
        send({ climbGrade: 3 }),
        send({ climbGrade: 3 }),
        send({ climbGrade: 4 }),
        send({ climbType: "sport", climbGrade: 10 }),
        send({ climbGrade: null }),
      ],
      "boulder",
    );
    expect(rows).toEqual([
      { grade: 4, label: "V3", count: 1 },
      { grade: 3, label: "V2", count: 2 },
    ]);
  });

  it("returns no rows for an empty slice", () => {
    expect(buildPyramid([], "sport")).toEqual([]);
  });
});

describe("buildUserAnalytics", () => {
  it("handles an empty log", () => {
    const a = buildUserAnalytics([], "all");
    expect(a.sendCount).toBe(0);
    expect(a.dateSpan).toBeNull();
    expect(a.progression).toEqual([]);
    expect(a.breakthroughs).toEqual([]);
    expect(a.longestStreak).toBeNull();
  });

  it("filters everything to the selected discipline", () => {
    const a = buildUserAnalytics(
      [
        send({ climbType: "boulder", dateSent: "2024-01-01" }),
        send({ climbType: "sport", climbGrade: 10, dateSent: "2024-02-01" }),
      ],
      "sport",
    );
    expect(a.sendCount).toBe(1);
    expect(a.disciplines).toEqual(["sport"]);
    expect(a.dateSpan).toEqual(["2024-02-01", "2024-02-01"]);
  });

  it("keeps per-discipline groupings under the all scope", () => {
    const a = buildUserAnalytics(
      [
        send({ climbType: "sport", climbGrade: 10, dateSent: "2024-01-05" }),
        send({ climbType: "boulder", climbGrade: 4, dateSent: "2024-01-06" }),
      ],
      "all",
    );
    expect(a.disciplines).toEqual(["boulder", "sport"]);
    expect(a.hardest.map((h) => [h.type, h.label])).toEqual([
      ["boulder", "V3"],
      ["sport", "5.10a"],
    ]);
    expect(a.hardestFirstTry).toBeNull();
  });

  it("tracks personal best as a running max over month-hardest points", () => {
    const a = buildUserAnalytics(
      [
        send({ climbGrade: 3, dateSent: "2024-01-04" }),
        send({ climbGrade: 5, dateSent: "2024-01-20" }),
        send({ climbGrade: 4, dateSent: "2024-03-02" }),
      ],
      "boulder",
    );
    expect(a.progression).toEqual([
      {
        type: "boulder",
        points: [
          { month: "2024-01", hardest: 5, best: 5 },
          { month: "2024-03", hardest: 4, best: 5 },
        ],
      },
    ]);
  });

  it("builds the pyramid hardest-first with zero fills", () => {
    const a = buildUserAnalytics(
      [
        send({ climbGrade: 2, dateSent: null }),
        send({ climbGrade: 2 }),
        send({ climbGrade: 4 }),
      ],
      "boulder",
    );
    expect(a.pyramid).toEqual([
      {
        type: "boulder",
        rows: [
          { grade: 4, label: "V3", count: 1 },
          { grade: 3, label: "V2", count: 0 },
          { grade: 2, label: "V1", count: 2 },
        ],
      },
    ]);
    expect(a.datelessCount).toBe(1);
  });

  it("records breakthroughs with the wait since the previous ceiling-raise", () => {
    const a = buildUserAnalytics(
      [
        send({ climbGrade: 3, climbName: "First", dateSent: "2024-01-01" }),
        send({ climbGrade: 3, climbName: "Repeat", dateSent: "2024-02-01" }),
        send({ climbGrade: 6, climbName: "Jump", dateSent: "2024-03-01" }),
      ],
      "boulder",
    );
    expect(a.breakthroughs.map((b) => [b.climbName, b.label, b.waitDays])).toEqual([
      ["Jump", "V5", 60],
      ["First", "V2", null],
    ]);
  });

  it("computes streaks, layoffs, and calendar aggregates from dated days", () => {
    const a = buildUserAnalytics(
      [
        send({ dateSent: "2024-01-01" }), // Monday
        send({ dateSent: "2024-01-02" }),
        send({ dateSent: "2024-01-03" }),
        send({ dateSent: "2024-03-04" }), // Monday after a 61-day layoff
        send({ dateSent: "2024-03-04", climbId: 999 }),
      ],
      "all",
    );
    expect(a.daysOut).toBe(4);
    expect(a.longestStreak).toEqual({ days: 3, end: "2024-01-03" });
    expect(a.longestLayoff).toEqual({ days: 61, from: "2024-01-03", to: "2024-03-04" });
    expect(a.busiestMonth).toEqual({ month: "2024-01", count: 3 });
    expect(a.favoriteWeekday).toEqual({ weekday: "Monday", count: 3 });
    expect(a.bestYear).toEqual({ year: 2024, count: 5 });
    expect(a.years).toEqual([2024]);
    expect(a.sendsByDay["2024-03-04"]).toBe(2);
  });

  it("finds the top area and hardest first-try within one discipline", () => {
    const a = buildUserAnalytics(
      [
        send({ areaId: 1, areaName: "Forestland" }),
        send({ areaId: 1, areaName: "Forestland" }),
        send({ areaId: 2, areaName: "Grand Wall", ascentStyle: "flash", climbGrade: 5 }),
      ],
      "boulder",
    );
    expect(a.areaCount).toBe(2);
    expect(a.topArea).toEqual({ id: 1, name: "Forestland", count: 2 });
    expect(a.flashCount).toBe(1);
    expect(a.hardestFirstTry?.label).toBe("V4");
  });
});
