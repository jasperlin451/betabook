import { describe, expect, it } from "vitest";

import {
  getTourDemoJournalPage,
  TOUR_DEMO_ANALYTICS,
  TOUR_DEMO_ENTRIES,
  TOUR_DEMO_PROJECT,
  TOUR_DEMO_SENDS,
} from "@/lib/product-tour-demo";

// Keep the cross-page story correct when future showcases extend the demo logbook.
describe("demo climber across tutorial pages", () => {
  it("counts repeats in the journal without duplicating the original ascent", () => {
    const repeat = TOUR_DEMO_ENTRIES.find((entry) => entry.outcome === "Repeat")!;
    const ascents = TOUR_DEMO_SENDS.filter((send) => send.climbId === repeat.climb?.id);
    expect(ascents).toHaveLength(1);
    expect(ascents[0].dateSent < repeat.date).toBe(true);
    expect(TOUR_DEMO_ANALYTICS.sendCount).toBe(3);
  });

  it("keeps an unsent climb's prior sessions together in Projects", () => {
    expect(TOUR_DEMO_PROJECT.sessions).toHaveLength(2);
    expect(TOUR_DEMO_PROJECT.sessions.every((entry) => entry.outcome === "Session")).toBe(true);
    expect(TOUR_DEMO_SENDS.some((send) => send.climbId === TOUR_DEMO_PROJECT.id)).toBe(false);
  });

  it("uses outdoor dates, excluding training and grouping same-day entries", () => {
    expect(TOUR_DEMO_ANALYTICS.daysOut).toBe(4);
    expect(TOUR_DEMO_ANALYTICS.calendarCounts["2026-03-12"]).toBe(3);
    expect(TOUR_DEMO_ANALYTICS.calendarCounts["2026-03-13"]).toBeUndefined();
    expect(TOUR_DEMO_ANALYTICS.calendarCounts["2026-03-14"]).toBe(1);
  });

  it("preserves the personal best when the next month's hardest send is lower", () => {
    const points = TOUR_DEMO_ANALYTICS.progression[0].points;
    expect(points).toHaveLength(3);
    expect(points[2].hardest).toBeLessThan(points[1].hardest);
    expect(points[2].best).toBe(points[1].best);
    expect(TOUR_DEMO_ANALYTICS.hardest[0].label).toBe("V4");
  });
});

describe("Journal tutorial preview", () => {
  const filters = { kind: null, query: "", tag: null, showAll: false };

  it("starts with three entries and can expand the full journal", () => {
    const page = getTourDemoJournalPage(filters);
    expect(page.visible).toHaveLength(3);
    expect(page.matches).toHaveLength(8);
    expect(getTourDemoJournalPage({ ...filters, showAll: true }).visible).toEqual(page.matches);
  });

  it("searches entries beyond the three initially displayed rows", () => {
    const page = getTourDemoJournalPage({ ...filters, query: " FIRST CLIMB " });
    expect(page.visible.map((entry) => entry.id)).toEqual(["warmup"]);
  });

  it("combines entry type, tag, and search across the whole journal", () => {
    const page = getTourDemoJournalPage({ ...filters, kind: "training", tag: "footwork" });
    expect(page.visible.map((entry) => entry.id)).toEqual(["training"]);
    expect(
      getTourDemoJournalPage({ ...filters, kind: "training", tag: "footwork", query: "pull-ups" })
        .matches,
    ).toEqual([]);
    expect(
      getTourDemoJournalPage({ ...filters, tag: "strength" }).visible.map((entry) => entry.id),
    ).toEqual(["strength"]);
  });
});
