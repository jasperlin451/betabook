import { expect, it } from "vitest";

import { goalInputSchema, goalToday, goalWindow } from "./goals";

it("uses calendar weeks and handles leap-month and year boundaries", () => {
  expect(goalWindow("week", "2026-09-13", "2026-09-13")).toEqual({
    startDate: "2026-09-07",
    endDate: "2026-09-13",
  });
  expect(goalWindow("week", "2026-09-14", "2026-09-14")).toEqual({
    startDate: "2026-09-14",
    endDate: "2026-09-20",
  });
  expect(goalWindow("month", "2028-02-12", "2028-02-12").endDate).toBe("2028-02-29");
  expect(goalWindow("year", "2026-12-31", "2026-12-31")).toEqual({
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  expect(goalToday("America/Los_Angeles", new Date("2026-09-14T01:00:00Z"))).toBe("2026-09-13");
});
it("rejects invalid dates, timezones, targets and grade shapes", () => {
  const value = {
    kind: "training",
    target: 3,
    discipline: null,
    grade: null,
    timeframe: "month",
    endDate: "2026-09-30",
    repeat: "none",
    timezone: "UTC",
  };
  expect(goalInputSchema.safeParse(value).success).toBe(true);
  for (const patch of [
    { endDate: "2026-02-30" },
    { timezone: "Not/AZone" },
    { target: 0 },
    { target: 1.5 },
    { kind: "grade", grade: null },
    { kind: "days", repeat: "week" },
  ])
    expect(goalInputSchema.safeParse({ ...value, ...patch }).success).toBe(false);
});

it("restricts minimum-grade matching to volume goals with a selected grade", () => {
  const value = {
    kind: "volume",
    target: 8,
    discipline: "boulder",
    grade: 5,
    gradeMatch: "at-least",
    timeframe: "year",
    endDate: "2026-12-31",
    repeat: "none",
    timezone: "UTC",
  };
  expect(goalInputSchema.safeParse(value).success).toBe(true);
  expect(goalInputSchema.safeParse({ ...value, grade: null }).success).toBe(false);
  expect(goalInputSchema.safeParse({ ...value, kind: "grade", target: 1 }).success).toBe(false);
  expect(goalInputSchema.parse({ ...value, gradeMatch: undefined }).gradeMatch).toBe("exact");
});
