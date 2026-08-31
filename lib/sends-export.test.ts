import { describe, expect, it } from "vitest";
import { buildSendsExportCsv } from "./sends-export";
import {
  distinctValues,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessColumnMapping,
  guessGradeFeelMapping,
  normalizeImportRows,
  parseCsvText,
} from "./sends-import";
import { parseGrade } from "./grades";
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

  it("renders an unknown grade using formatGrade's own fallback", () => {
    const csvText = buildSendsExportCsv([row({ climbGrade: null })]);
    expect(csvText).toContain("—");
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

describe("export → import round trip", () => {
  it("re-imports a betabook export with identical send fields", () => {
    const exported = buildSendsExportCsv([
      row({
        climbName: "The Mandala",
        climbType: "boulder",
        climbGrade: 13, // V12 posted
        suggestedGrade: 14, // user suggested V13
        gradeFeel: "high",
        ascentStyle: "flash",
        dateSent: "2026-01-01",
        rating: 4,
        comment: "Great, fun climb",
      }),
      row({
        climbName: "No Opinion",
        climbType: "sport",
        climbGrade: 16, // 5.11c posted
        suggestedGrade: null, // no suggestion recorded on the send
        gradeFeel: "solid",
        ascentStyle: "onsight",
        dateSent: null,
        rating: null,
        comment: null,
      }),
    ]);

    // Parse and auto-map exactly the way the wizard does.
    const parsed = parseCsvText(exported);
    expect(parsed.warnings).toEqual([]);
    const mapping = guessColumnMapping(parsed.headers);
    const ascentStyleMapping = guessAscentStyleMapping(
      distinctValues(parsed.rows, mapping.ascentStyle),
    );
    const climbTypeMapping = guessClimbTypeMapping(
      distinctValues(parsed.rows, mapping.climbType),
    );
    const gradeFeelMapping = guessGradeFeelMapping(
      distinctValues(parsed.rows, mapping.gradeFeel),
    );

    const { valid, invalid, warnings } = normalizeImportRows(
      parsed,
      mapping,
      ascentStyleMapping,
      climbTypeMapping,
      gradeFeelMapping,
      "iso",
      { today: "2026-08-19" },
    );
    expect(invalid).toEqual([]);
    expect(warnings).toEqual([]);
    expect(valid).toHaveLength(2);

    const [withSuggestion, withoutSuggestion] = valid;
    expect(withSuggestion.climbName).toBe("The Mandala");
    expect(withSuggestion.ascentStyle).toBe("flash");
    expect(withSuggestion.dateSent).toBe("2026-01-01");
    expect(withSuggestion.rating).toBe(4);
    expect(withSuggestion.comment).toBe("Great, fun climb");
    expect(withSuggestion.gradeFeel).toBe("high");
    expect(withSuggestion.climbTypeHint).toBe("boulder");
    // The Suggested Grade column (not the posted Grade column) round-trips
    // to the same ordinal importSends will store.
    expect(withSuggestion.blankGradeMeans).toBe("no-suggestion");
    expect(withSuggestion.gradeText).not.toBeNull();
    expect(parseGrade("boulder", withSuggestion.gradeText!, "native")).toBe(14);

    // A send exported without a suggested grade stays that way: blank cell +
    // "no-suggestion" makes importSends store null instead of falling back
    // to the climb's posted grade.
    expect(withoutSuggestion.gradeText).toBeNull();
    expect(withoutSuggestion.blankGradeMeans).toBe("no-suggestion");
    expect(withoutSuggestion.ascentStyle).toBe("onsight");
    expect(withoutSuggestion.dateSent).toBeNull();
    expect(withoutSuggestion.rating).toBeNull();
    expect(withoutSuggestion.comment).toBeNull();
    expect(withoutSuggestion.gradeFeel).toBe("solid");
  });
});
