import { describe, expect, it } from "vitest";
import { mergeRefreshedSentClimbIds } from "./climb-search-pages";

describe("mergeRefreshedSentClimbIds", () => {
  it("adopts sends returned by a server refresh without losing later pages", () => {
    const merged = mergeRefreshedSentClimbIds(new Set([1, 2]), new Set([2, 30]));
    expect(merged).toEqual(new Set([1, 2, 30]));
  });

  it("drops accumulated authenticated state when the viewer is signed out", () => {
    expect(mergeRefreshedSentClimbIds(undefined, new Set([30]))).toBeUndefined();
  });
});
