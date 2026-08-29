import { describe, expect, it } from "vitest";
import { searchParamsToRecord } from "./search-params";
import {
  climbSearchFilterToSearchParams,
  DEFAULT_CLIMB_SEARCH_FILTER,
  DEFAULT_CLIMB_SEARCH_SORT,
  parseClimbSearchFilter,
  parseClimbSearchSort,
  type ClimbSearchFilter,
} from "./climb-search-filter";

// The debounced filter navigation only fires when the href built from local
// state differs from the canonical href of the current URL (see
// hooks/use-debounced-replace.ts). That comparison relies on serialization
// being a fixed point of parse -> serialize: any URL, parsed and
// re-serialized, must re-serialize to the same string.
function reserialize(params: URLSearchParams): string {
  const record = searchParamsToRecord(params);
  return climbSearchFilterToSearchParams(
    parseClimbSearchSort(record),
    parseClimbSearchFilter(record),
  ).toString();
}

describe("climb search filter serialization", () => {
  it("reaches a fixed point from a bare URL", () => {
    const canonical = reserialize(new URLSearchParams());
    expect(reserialize(new URLSearchParams(canonical))).toBe(canonical);
  });

  it("serializes the parsed bare URL like the default filter", () => {
    expect(reserialize(new URLSearchParams())).toBe(
      climbSearchFilterToSearchParams(
        DEFAULT_CLIMB_SEARCH_SORT,
        DEFAULT_CLIMB_SEARCH_FILTER,
      ).toString(),
    );
  });

  it("round-trips a fully populated filter", () => {
    const filter: ClimbSearchFilter = {
      ...DEFAULT_CLIMB_SEARCH_FILTER,
      name: "Midnight Lightning",
      areaName: "Yosemite",
      disciplines: ["boulder", "sport"],
      boulderRange: [2, 8],
      sportRange: [1, 20],
      ratingRange: [2, 5],
      minAscents: 3,
    };
    const params = climbSearchFilterToSearchParams("grade_desc", filter);
    const record = searchParamsToRecord(params);

    expect(parseClimbSearchSort(record)).toBe("grade_desc");
    expect(parseClimbSearchFilter(record)).toEqual(filter);
    expect(reserialize(params)).toBe(params.toString());
  });
});
