import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANALYTICS_LAYOUT,
  moveAnalyticsItem,
  parseAnalyticsLayout,
} from "./analytics-layout";

describe("saved analytics layouts", () => {
  it("stores only visible items in their chosen order without adding optional items", () => {
    expect(
      parseAnalyticsLayout({ version: 2, cards: ["partner", "sends"], charts: ["volume"] }),
    ).toEqual({
      version: 2,
      cards: ["partner", "sends"],
      charts: ["volume"],
    });
  });
  it("migrates legacy layouts by removing hidden items while retaining order", () => {
    expect(
      parseAnalyticsLayout({
        version: 1,
        cards: ["hardest", "sends", "partner", "areas"],
        charts: ["calendar", "volume", "pyramid"],
        hidden: ["areas", "calendar"],
      }),
    ).toEqual({
      version: 2,
      cards: ["hardest", "sends", "partner"],
      charts: ["volume", "pyramid"],
    });
  });
  it("keeps deliberately empty layouts empty, including legacy layouts", () => {
    expect(parseAnalyticsLayout({ version: 2, cards: [], charts: [] })).toEqual({
      version: 2,
      cards: [],
      charts: [],
    });
    expect(
      parseAnalyticsLayout({
        version: 1,
        cards: ["sends"],
        charts: ["calendar"],
        hidden: ["sends", "calendar"],
      }),
    ).toEqual({ version: 2, cards: [], charts: [] });
  });
  it("removes obsolete, duplicate, and wrong-section IDs without resetting the remaining choices", () => {
    expect(
      parseAnalyticsLayout({
        version: 2,
        cards: ["partner", "climbingStreak", "partner", "calendar", "sends"],
        charts: ["flashRate", "sends", "flashRate"],
      }),
    ).toEqual({ version: 2, cards: ["partner", "sends"], charts: ["flashRate"] });
  });
  it("recovers corrupt or unsupported preferences", () => {
    for (const value of [
      null,
      "bad",
      {},
      { version: 3 },
      { version: 2, cards: "bad", charts: [] },
    ]) {
      expect(parseAnalyticsLayout(value)).toEqual(DEFAULT_ANALYTICS_LAYOUT);
    }
  });
});
describe("moving analytics items", () => {
  it("moves before or after an existing item without duplicating or losing cards", () => {
    const items = ["sends", "hardest", "days"];
    expect(moveAnalyticsItem(items, "days", "sends")).toEqual(["days", "sends", "hardest"]);
    expect(moveAnalyticsItem(items, "sends", "hardest", "after")).toEqual([
      "hardest",
      "sends",
      "days",
    ]);
    expect(items).toEqual(["sends", "hardest", "days"]);
  });
  it("ignores cross-section or missing targets and self drops", () => {
    const items = ["sends", "hardest"];
    expect(moveAnalyticsItem(items, "calendar", "sends")).toEqual(items);
    expect(moveAnalyticsItem(items, "sends", "calendar")).toEqual(items);
    expect(moveAnalyticsItem(items, "sends", "sends")).toEqual(items);
  });
});
