import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANALYTICS_LAYOUT,
  moveAnalyticsItem,
  parseAnalyticsLayout,
} from "./analytics-layout";

describe("saved analytics layouts", () => {
  it("preserves custom ordering and hidden items while restoring missing defaults", () => {
    const layout = parseAnalyticsLayout({
      version: 1,
      cards: ["streak", "sends", "streak", "calendar", "obsolete"],
      charts: ["calendar", "progression"],
      hidden: ["areas", "calendar", "areas", "obsolete"],
    });
    expect(layout.cards).toEqual([
      "streak",
      "sends",
      "hardest",
      "days",
      "firstTry",
      "bestYear",
      "busiestMonth",
      "areas",
      "favoriteDay",
      "layoff",
      "partner",
      "biggestProject",
      "persistence",
      "favoriteRepeat",
    ]);
    expect(layout.charts).toEqual([
      "calendar",
      "progression",
      "pyramid",
      "breakthroughs",
      "volume",
      "flashRate",
    ]);
    expect(layout.hidden).toEqual([
      "areas",
      "calendar",
      "partner",
      "biggestProject",
      "persistence",
      "favoriteRepeat",
      "volume",
      "flashRate",
    ]);
  });
  it("recovers corrupt or unsupported preferences", () => {
    for (const value of [
      null,
      "bad",
      {},
      { version: 2 },
      { version: 1, cards: "bad", charts: null, hidden: 42 },
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

it("removes the retired climbing streak card from saved layouts", () => {
  const layout = parseAnalyticsLayout({
    ...DEFAULT_ANALYTICS_LAYOUT,
    cards: ["climbingStreak", ...DEFAULT_ANALYTICS_LAYOUT.cards],
    hidden: ["climbingStreak"],
  });
  expect(layout.cards).not.toContain("climbingStreak");
  expect(layout.hidden).not.toContain("climbingStreak");
  expect(layout.cards).toContain("streak");
});

it("keeps new optional charts hidden in defaults and existing layouts", () => {
  const existing = parseAnalyticsLayout({
    version: 1,
    cards: DEFAULT_ANALYTICS_LAYOUT.cards,
    charts: ["calendar", "progression", "pyramid", "breakthroughs"],
    hidden: [],
  });
  expect(existing.charts).toEqual([
    "calendar",
    "progression",
    "pyramid",
    "breakthroughs",
    "volume",
    "flashRate",
  ]);
  expect(existing.hidden).toEqual(["volume", "flashRate"]);
  expect(DEFAULT_ANALYTICS_LAYOUT.hidden).toEqual(expect.arrayContaining(["volume", "flashRate"]));
});
