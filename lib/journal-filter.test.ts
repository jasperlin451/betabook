import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOURNAL_FILTER,
  JOURNAL_VIEWS,
  type JournalView,
  MAX_JOURNAL_QUERY_LENGTH,
  journalFilterToSearchParams,
  parseJournalFilter,
} from "@/lib/journal-filter";

describe("parseJournalFilter", () => {
  it("reads an empty query as the default view", () => {
    expect(parseJournalFilter({})).toEqual(DEFAULT_JOURNAL_FILTER);
  });

  it.each(JOURNAL_VIEWS)("parses the %s view", (view: JournalView) => {
    expect(parseJournalFilter({ view }).view).toBe(view);
  });

  it("falls back to the default view on an unknown chip", () => {
    expect(parseJournalFilter({ view: "repeats" }).view).toBe("all");
    expect(parseJournalFilter({ view: "projects" }).view).toBe("all");
  });

  it("normalizes the tag the same way the write path stores it", () => {
    expect(parseJournalFilter({ tag: " Hangboard " }).tag).toBe("hangboard");
    expect(parseJournalFilter({ tag: "Happy  Boulders" }).tag).toBe("happy boulders");
  });

  it("reads a blank tag as absent", () => {
    expect(parseJournalFilter({ tag: "   " }).tag).toBeNull();
  });

  it("normalizes and limits a journal search", () => {
    expect(parseJournalFilter({ q: "  top   move  " }).query).toBe("top move");
    expect(parseJournalFilter({ q: "x".repeat(120) }).query).toHaveLength(MAX_JOURNAL_QUERY_LENGTH);
  });

  it("reads a climb id, and drops junk", () => {
    expect(parseJournalFilter({ climbId: "42" }).climbId).toBe(42);
    for (const climbId of ["0", "-3", "abc", "1.5"]) {
      expect(parseJournalFilter({ climbId }).climbId).toBeNull();
    }
  });

  it("reads a year in range, and drops one outside it", () => {
    expect(parseJournalFilter({ year: "2025" }).year).toBe(2025);
    for (const year of ["1899", "2201", "not-a-year"]) {
      expect(parseJournalFilter({ year }).year).toBeNull();
    }
  });

  it("takes the first value when a param repeats", () => {
    expect(parseJournalFilter({ view: ["training", "all"] }).view).toBe("training");
  });
});

describe("journalFilterToSearchParams", () => {
  it("omits the default view, so a plain timeline has a clean URL", () => {
    expect(journalFilterToSearchParams(DEFAULT_JOURNAL_FILTER).toString()).toBe("");
  });

  it("round-trips a filled filter", () => {
    const filter = {
      view: "training" as const,
      query: "top move",
      tag: "happy boulders",
      climbId: 7,
      year: 2025,
    };
    const params = journalFilterToSearchParams(filter);
    expect(parseJournalFilter(Object.fromEntries(params))).toEqual(filter);
  });
});
