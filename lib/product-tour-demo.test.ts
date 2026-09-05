import { describe, expect, it } from "vitest";

import {
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
