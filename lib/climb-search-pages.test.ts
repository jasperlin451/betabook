import { describe, expect, it } from "vitest";

import { createClimbListMeta, mergeClimbListMeta } from "./climb-search-pages";

describe("mergeClimbListMeta", () => {
  it("accumulates metadata from a newly loaded page", () => {
    const current = createClimbListMeta({
      sendStats: {
        1: { avgRating: null, sendCount: 1, avgSuggestedGrade: null },
      },
      areaBreadcrumbs: { 1: [{ id: 10, name: "First" }] },
      sentClimbIds: [1],
    });
    const next = createClimbListMeta({
      sendStats: {
        30: { avgRating: 5, sendCount: 2, avgSuggestedGrade: null },
      },
      areaBreadcrumbs: { 30: [{ id: 11, name: "Second" }] },
      sentClimbIds: [30],
    });

    const merged = mergeClimbListMeta(current, next);
    expect(merged.sentClimbIds).toEqual(new Set([1, 30]));
    expect(merged.sendStats[30]).toEqual({
      avgRating: 5,
      sendCount: 2,
      avgSuggestedGrade: null,
    });
    expect(merged.areaBreadcrumbs[30]).toEqual([{ id: 11, name: "Second" }]);
  });

  it("keeps signed-out metadata unauthenticated", () => {
    const current = createClimbListMeta({
      sendStats: {},
      areaBreadcrumbs: {},
    });
    const next = createClimbListMeta({
      sendStats: {},
      areaBreadcrumbs: {},
    });

    expect(mergeClimbListMeta(current, next).sentClimbIds).toBeUndefined();
  });
});
