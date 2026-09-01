import { describe, expect, it } from "vitest";
import { mergeRefreshedSentClimbIds } from "./climb-search-pages";

describe("mergeRefreshedSentClimbIds", () => {
  it("adopts sends returned by a server refresh without losing later pages", () => {
    const merged = mergeRefreshedSentClimbIds(new Set([1, 2]), new Set([2, 30]), [1, 2, 3]);
    expect(merged).toEqual(new Set([1, 2, 30]));
  });

  it("drops accumulated authenticated state when the viewer is signed out", () => {
    expect(mergeRefreshedSentClimbIds(undefined, new Set([30]), [1, 2])).toBeUndefined();
  });

  it("lets a refresh un-send a climb on the page it re-rendered", () => {
    // The send for climb 2 was deleted, so the refreshed first page no longer
    // reports it. A plain union would keep resurrecting it from `accumulated`.
    const merged = mergeRefreshedSentClimbIds(new Set([1]), new Set([1, 2, 30]), [1, 2, 3]);
    expect(merged).toEqual(new Set([1, 30]));
  });

  it("keeps accumulated ids for climbs the refreshed page never covered", () => {
    // Climb 30 lives on a later page, so the refreshed first page says nothing
    // about it either way — the accumulated answer is the only one there is.
    const merged = mergeRefreshedSentClimbIds(new Set(), new Set([30]), [1, 2, 3]);
    expect(merged).toEqual(new Set([30]));
  });
});
