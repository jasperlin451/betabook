import { describe, expect, it } from "vitest";

import { calendarMonth, formatDate } from "./format-date";

describe("formatDate", () => {
  it("formats a stored civil date", () => {
    expect(formatDate("2026-08-28")).toBe("Aug 28, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2025-12-31")).toBe("Dec 31, 2025");
  });

  it("falls back to '—' for a missing date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("returns an unparseable string as-is", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("calendarMonth", () => {
  it("uses the requested timezone at a month boundary", () => {
    const instant = new Date("2026-09-01T00:30:00.000Z");
    expect(calendarMonth(instant, "UTC")).toBe("2026-09");
    expect(calendarMonth(instant, "America/Los_Angeles")).toBe("2026-08");
  });
});
