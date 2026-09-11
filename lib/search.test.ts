import { describe, expect, it } from "vitest";

import { withClimbFilterArea } from "@/lib/filters/climb-filter-state";
import {
  parseUserSendsFilter,
  userSendsFilterToSearchParams,
} from "@/lib/filters/user-sends-filter";

import { EMPTY_SEARCH, parseSearchState, searchHref } from "./search";
import { searchParamsToRecord } from "./url-params";

describe("unified search URL state", () => {
  it("preserves query, category, exact scope and climb refinements across expansion and parsing", () => {
    const state = withClimbFilterArea(
      {
        ...EMPTY_SEARCH,
        query: "Cedar & pine",
        category: "climb" as const,
        sort: "grade_desc",
        filter: {
          ...EMPTY_SEARCH.filter,
          disciplines: ["boulder"],
          boulderRange: [3, 7],
          ratingRange: [3, 5],
          minAscents: 4,
        },
      },
      { id: "2", name: "Cedar Grove", path: "Oregon" },
    );
    const params = new URL(searchHref(state), "https://example.test").searchParams;
    const parsed = parseSearchState(searchParamsToRecord(params), state.area);
    expect(parsed).toEqual({ ...state, filter: { ...state.filter, name: state.query } });
    expect(searchHref(parsed)).toBe(searchHref(state));
    expect(params.get("areaId")).toBe("2");
    expect(params.has("areaName")).toBe(false);
  });
  it("opens on most ascents first and keeps any explicit sort", () => {
    expect(EMPTY_SEARCH.sort).toBe("ascents_desc");
    expect(parseSearchState({}).sort).toBe("ascents_desc");
    expect(parseSearchState({ sort: "name_asc" }).sort).toBe("name_asc");
    expect(parseSearchState({ sort: "not a sort" }).sort).toBe("ascents_desc");
  });
  it("clears an area identity and obsolete text scoping together while keeping the query", () => {
    const state = withClimbFilterArea(
      {
        ...EMPTY_SEARCH,
        query: "cedar",
        filter: { ...EMPTY_SEARCH.filter, areaName: "wrong name" },
      },
      { id: "2", name: "Cedar", path: "" },
    );
    expect(withClimbFilterArea(state, null)).toMatchObject({
      query: "cedar",
      area: null,
      filter: { areaId: undefined, areaName: undefined },
    });
  });
  it("round trips the selected area in Sends without trusting its name for identity", () => {
    const filter = parseUserSendsFilter({ areaId: "3", areaName: "Cedar Grove" });
    expect(filter.areaId).toBe(3);
    expect(
      parseUserSendsFilter(searchParamsToRecord(userSendsFilterToSearchParams(filter))),
    ).toEqual(filter);
    expect(parseUserSendsFilter({ areaId: "bad" }).areaId).toBe(0);
  });
});
