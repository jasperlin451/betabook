import { describe, expect, it } from "vitest";
import { buildSendsExportCsv } from "./sends-export";
import type { UserSendRow } from "@/db/queries";

function row(overrides: Partial<UserSendRow> = {}): UserSendRow {
  return {
    id: 1,
    climbId: 1,
    climbName: "Test Highball",
    climbType: "boulder",
    climbGrade: 5,
    areaId: 1,
    areaName: "Test Highball Alcove",
    ascentStyle: "redpoint",
    dateSent: "2026-01-01",
    rating: 4,
    suggestedGrade: null,
    gradeFeel: "solid",
    comment: null,
    ...overrides,
  };
}

describe("buildSendsExportCsv", () => {
  it("outputs the expected header row", () => {
    const csvText = buildSendsExportCsv([]);
    const [header] = csvText.trim().split("\n");
    expect(header).toBe(
      [
        "Date Sent",
        "Ascent Style",
        "Climb Name",
        "Area Name",
        "Climb Type",
        "Grade",
        "Suggested Grade",
        "Grade Feel",
        "Rating",
        "Comment",
      ].join(","),
    );
  });

  it("capitalizes ascent style and climb type, and formats the grade", () => {
    const csvText = buildSendsExportCsv([row({ ascentStyle: "flash", climbType: "boulder", climbGrade: 5 })]);
    expect(csvText).toContain("Flash");
    expect(csvText).toContain("Boulder");
    expect(csvText).toContain("V4");
  });

  it("renders an unknown grade using formatGrade's own label", () => {
    const csvText = buildSendsExportCsv([row({ climbGrade: null })]);
    expect(csvText).toContain("Grade unknown");
  });

  it("renders a null suggested grade, rating, and comment as blank", () => {
    const csvText = buildSendsExportCsv([
      row({ suggestedGrade: null, rating: null, comment: null }),
    ]);
    const [, dataLine] = csvText.trim().split("\n");
    expect(dataLine.endsWith(",Solid,,")).toBe(true);
  });

  it("formats a non-null suggested grade through formatGrade", () => {
    const csvText = buildSendsExportCsv([row({ climbType: "boulder", suggestedGrade: 6 })]);
    expect(csvText).toContain("V5");
  });

  it("capitalizes the grade feel", () => {
    for (const [gradeFeel, expected] of [
      ["low", "Low"],
      ["solid", "Solid"],
      ["high", "High"],
    ] as const) {
      const csvText = buildSendsExportCsv([row({ gradeFeel })]);
      expect(csvText).toContain(expected);
    }
  });
});
