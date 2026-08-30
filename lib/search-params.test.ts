import { describe, expect, it } from "vitest";
import {
  MAX_SUGGESTION_LIMIT,
  parseAscentStyles,
  parseDisciplines,
  parseSuggestionLimit,
  searchParamsToRecord,
  toArray,
  toRange,
} from "./search-params";

describe("toArray", () => {
  it("returns an empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });

  it("wraps a single value in an array", () => {
    expect(toArray("boulder")).toEqual(["boulder"]);
  });

  it("passes an array through unchanged", () => {
    expect(toArray(["boulder", "sport"])).toEqual(["boulder", "sport"]);
  });
});

describe("toRange", () => {
  const fallback: [number, number] = [0, 10];

  it("returns the fallback when fewer than two finite values are present", () => {
    expect(toRange(undefined, fallback)).toEqual(fallback);
    expect(toRange("3", fallback)).toEqual(fallback);
    expect(toRange(["3", "nope"], fallback)).toEqual(fallback);
  });

  it("returns [min, max] for two finite values", () => {
    expect(toRange(["5", "2"], fallback)).toEqual([2, 5]);
  });
});

describe("parseDisciplines", () => {
  it("filters to only valid disciplines", () => {
    expect(parseDisciplines({ discipline: ["boulder", "invalid", "trad"] })).toEqual([
      "boulder",
      "trad",
    ]);
  });

  it("returns an empty array when the key is absent", () => {
    expect(parseDisciplines({})).toEqual([]);
  });

  it("supports a custom key", () => {
    expect(parseDisciplines({ style: "sport" }, "style")).toEqual(["sport"]);
  });
});

describe("parseAscentStyles", () => {
  it("filters to only valid ascent styles", () => {
    expect(parseAscentStyles({ ascentStyle: ["flash", "invalid", "onsight"] })).toEqual([
      "flash",
      "onsight",
    ]);
  });

  it("returns an empty array when the key is absent", () => {
    expect(parseAscentStyles({})).toEqual([]);
  });

  it("supports a custom key", () => {
    expect(parseAscentStyles({ style: "redpoint" }, "style")).toEqual(["redpoint"]);
  });
});

describe("searchParamsToRecord", () => {
  it("flattens a URLSearchParams into arrays of values per key", () => {
    const params = new URLSearchParams();
    params.append("discipline", "boulder");
    params.append("discipline", "sport");
    params.append("page", "2");

    expect(searchParamsToRecord(params)).toEqual({
      discipline: ["boulder", "sport"],
      page: ["2"],
    });
  });

  it("returns an empty record for empty search params", () => {
    expect(searchParamsToRecord(new URLSearchParams())).toEqual({});
  });
});

describe("parseSuggestionLimit", () => {
  function limitOf(query: string) {
    return parseSuggestionLimit(new URLSearchParams(query));
  }

  it("returns null when absent, which is what the paginated path sends", () => {
    expect(limitOf("name=squamish&page=2")).toBeNull();
  });

  it("reads a valid limit", () => {
    expect(limitOf("limit=5")).toBe(5);
  });

  it("caps the limit so a suggestion lookup can't ask for a full table read", () => {
    expect(limitOf(`limit=${MAX_SUGGESTION_LIMIT + 500}`)).toBe(MAX_SUGGESTION_LIMIT);
  });

  // Degrading to the unlimited path beats returning an empty page: a
  // malformed suggestion request should behave like a plain search, not like
  // a search that matched nothing.
  it.each(["limit=0", "limit=-5", "limit=abc", "limit="])("reads %s as no limit", (query) => {
    expect(limitOf(query)).toBeNull();
  });

  it("truncates a fractional limit rather than rejecting it", () => {
    expect(limitOf("limit=3.7")).toBe(3);
  });
});
