import { describe, expect, it } from "vitest";

import type { UserSendsFilter } from "@/db/queries";

import { searchParamsToRecord } from "./search-params";
import {
  DEFAULT_USER_SENDS_FILTER,
  parseUserSendsFilter,
  userSendsFilterToSearchParams,
} from "./user-sends-filter";

// Same fixed-point invariant as climb-search-filter.test.ts: the user sends
// page's debounced filter navigation compares built hrefs against the
// canonical re-serialization of the current URL, so parse -> serialize must
// be stable.
function reserialize(params: URLSearchParams): string {
  return userSendsFilterToSearchParams(
    parseUserSendsFilter(searchParamsToRecord(params)),
  ).toString();
}

describe("user sends filter serialization", () => {
  it("reaches a fixed point from a bare URL", () => {
    const canonical = reserialize(new URLSearchParams());
    expect(reserialize(new URLSearchParams(canonical))).toBe(canonical);
  });

  it("serializes the parsed bare URL like the default filter", () => {
    expect(reserialize(new URLSearchParams())).toBe(
      userSendsFilterToSearchParams(DEFAULT_USER_SENDS_FILTER).toString(),
    );
  });

  it("round-trips a fully populated filter", () => {
    const filter: UserSendsFilter = {
      ...DEFAULT_USER_SENDS_FILTER,
      name: "Astroman",
      areaName: "Washington Column",
      disciplines: ["boulder", "trad"],
      boulderRange: [1, 6],
      tradRange: [4, 18],
      sort: "grade_asc",
      ascentStyles: ["flash", "onsight"],
      minRating: 3,
    };
    const params = userSendsFilterToSearchParams(filter);
    expect(params.toString()).toBe(
      "discipline=boulder&discipline=trad&boulderRange=1&boulderRange=6&tradRange=4&tradRange=18&name=Astroman&areaName=Washington+Column&sort=grade_asc&ascentStyle=flash&ascentStyle=onsight&minRating=3",
    );
    const record = searchParamsToRecord(params);

    expect(parseUserSendsFilter(record)).toEqual(filter);
    expect(reserialize(params)).toBe(params.toString());
  });
});
