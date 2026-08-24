import { describe, expect, it } from "vitest";
import {
  buildFailedRowsCsv,
  detectDateFormat,
  guessColumnMapping,
  normalizeImportRows,
  parseCsvText,
  parseDateWithFormat,
  type AscentStyleMapping,
  type BatchErrorRow,
  type ClimbTypeMapping,
  type ColumnMapping,
  type InvalidImportRow,
  type NotFoundRow,
  type ParsedCsv,
} from "./sends-import";

const SAMPLE_HEADERS = [
  "Date",
  "Send Type",
  "Climb",
  "Climb Type",
  "Grade",
  "Area",
  "Country",
  "Rating",
  "Comments",
];

const FULL_MAPPING: ColumnMapping = {
  date: "Date",
  ascentStyle: "Send Type",
  climbName: "Climb",
  areaName: "Area",
  climbType: "Climb Type",
  grade: "Grade",
  rating: "Rating",
  comment: "Comments",
};

const ASCENT_STYLE_MAPPING: AscentStyleMapping = {
  redpoint: "redpoint",
  flash: "flash",
  onsight: "onsight",
};

const CLIMB_TYPE_MAPPING: ClimbTypeMapping = {
  boulder: "boulder",
  sport: "sport",
  trad: "trad",
};

const TODAY = "2026-08-19";

function csv(rows: Record<string, string>[]): ParsedCsv {
  return { headers: SAMPLE_HEADERS, rows };
}

function row(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    Date: "2026-08-12",
    "Send Type": "onsight",
    Climb: "I'll Burn the Building Down",
    "Climb Type": "sport",
    Grade: "5.11c",
    Area: "Office Space",
    Country: "",
    Rating: "4",
    Comments: "Very fun climbing",
    ...overrides,
  };
}

describe("parseCsvText", () => {
  it("skips metadata lines before the real header row", () => {
    // Realistic shape: a couple of short metadata lines, then a header and
    // several data rows — the data rows' column count should clearly
    // outnumber the metadata lines' column count, not just tie with it.
    const text = [
      '"These climbs were exported from Sendage Climbing.",http://sendage.com',
      '"Michael Woo",2026-08-18',
      "",
      "",
      'Date,"Send Type",Climb,"Climb Type",Grade,Area,Country,Rating,Comments',
      '2026-08-12,onsight,"I\'ll Burn the Building Down",sport,5.11c,"Office Space",,4,"Very fun climbing"',
      '2026-08-11,redpoint,"The Major Glitch",sport,5.13a,"Office Space",,3,',
      '2026-08-09,redpoint,"Something Rotten",sport,5.12a,"Little Half Dome",,4,',
    ].join("\n");

    const parsed = parseCsvText(text);
    expect(parsed.headers).toEqual(SAMPLE_HEADERS);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toEqual(row());
  });

  it("handles a plain CSV with no leading metadata", () => {
    const text = "Climb,Area\nMy Route,My Crag";
    const parsed = parseCsvText(text);
    expect(parsed.headers).toEqual(["Climb", "Area"]);
    expect(parsed.rows).toEqual([{ Climb: "My Route", Area: "My Crag" }]);
  });

  it("returns empty headers and rows for empty input", () => {
    expect(parseCsvText("")).toEqual({ headers: [], rows: [] });
  });

  it("parses quoted fields containing commas", () => {
    const text = 'Climb,Comments\n"My Route","Great, fun climb"';
    const parsed = parseCsvText(text);
    expect(parsed.rows[0].Comments).toBe("Great, fun climb");
  });
});

describe("guessColumnMapping", () => {
  it("maps the sample file's exact headers", () => {
    expect(guessColumnMapping(SAMPLE_HEADERS)).toEqual(FULL_MAPPING);
  });

  it("maps differently-named headers via aliases", () => {
    const headers = ["Ascent Date", "Style", "Route", "Discipline", "Difficulty", "Crag", "Stars", "Notes"];
    const mapping = guessColumnMapping(headers);
    expect(mapping).toEqual({
      date: "Ascent Date",
      ascentStyle: "Style",
      climbName: "Route",
      areaName: "Crag",
      climbType: "Discipline",
      grade: "Difficulty",
      rating: "Stars",
      comment: "Notes",
    });
  });

  it("leaves fields null when no header matches", () => {
    const mapping = guessColumnMapping(["Foo", "Bar"]);
    expect(mapping.date).toBeNull();
    expect(mapping.climbName).toBeNull();
  });

  it("doesn't let ascentStyle's generic 'type' alias steal the Climb Type column", () => {
    const mapping = guessColumnMapping(["Send Type", "Climb Type"]);
    expect(mapping.ascentStyle).toBe("Send Type");
    expect(mapping.climbType).toBe("Climb Type");
  });
});

describe("parseDateWithFormat", () => {
  it("parses ISO dates", () => {
    expect(parseDateWithFormat("2026-08-12", "iso")).toBe("2026-08-12");
  });

  it("parses MDY dates into ISO", () => {
    expect(parseDateWithFormat("8/12/2026", "mdy")).toBe("2026-08-12");
  });

  it("parses DMY dates into ISO", () => {
    expect(parseDateWithFormat("12/8/2026", "dmy")).toBe("2026-08-12");
  });

  it("returns null for blank input", () => {
    expect(parseDateWithFormat("", "iso")).toBeNull();
    expect(parseDateWithFormat("   ", "mdy")).toBeNull();
  });

  it("returns null for an invalid date under the given format", () => {
    expect(parseDateWithFormat("2026-13-40", "iso")).toBeNull();
    expect(parseDateWithFormat("13/40/2026", "mdy")).toBeNull();
  });

  it("returns null when the format doesn't match the string shape", () => {
    expect(parseDateWithFormat("8/12/2026", "iso")).toBeNull();
    expect(parseDateWithFormat("2026-08-12", "mdy")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("detects ISO dates", () => {
    expect(detectDateFormat(["2026-08-12", "2026-08-11", "2026-08-09"])).toBe("iso");
  });

  it("detects MDY dates (month > 12 disambiguates from DMY)", () => {
    expect(detectDateFormat(["8/25/2026", "8/26/2026"])).toBe("mdy");
  });

  it("detects DMY dates (day > 12 disambiguates from MDY)", () => {
    expect(detectDateFormat(["25/8/2026", "26/8/2026"])).toBe("dmy");
  });
});

describe("normalizeImportRows", () => {
  it("normalizes a fully-populated valid row", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row()]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(invalid).toEqual([]);
    expect(valid).toEqual([
      {
        climbName: "I'll Burn the Building Down",
        areaName: "Office Space",
        climbTypeHint: "sport",
        ascentStyle: "onsight",
        dateSent: "2026-08-12",
        rating: 4,
        comment: "Very fun climbing",
        gradeText: "5.11c",
        raw: row(),
      },
    ]);
  });

  it("treats a blank date as valid with a null dateSent", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(invalid).toEqual([]);
    expect(valid[0].dateSent).toBeNull();
  });

  it("rejects a non-blank unparseable date", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "not-a-date" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toMatch(/unparseable date/i);
  });

  it("rejects a date in the future", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "2026-08-20" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toMatch(/future/i);
  });

  it("rejects an unmapped ascent-style value", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ "Send Type": "attempt" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toMatch(/unmapped ascent style/i);
  });

  it("rejects an ascent-style value explicitly mapped to skip", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ "Send Type": "attempt" })]),
      FULL_MAPPING,
      { ...ASCENT_STYLE_MAPPING, attempt: "skip" },
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("truncates an over-length comment instead of rejecting the row", () => {
    const longComment = "a".repeat(300);
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Comments: longComment })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(invalid).toEqual([]);
    expect(valid[0].comment).toHaveLength(280);
  });

  it("treats blank optional fields as null", () => {
    const { valid } = normalizeImportRows(
      csv([row({ Grade: "", Rating: "", Comments: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid[0].gradeText).toBeNull();
    expect(valid[0].rating).toBeNull();
    expect(valid[0].comment).toBeNull();
  });

  it("leaves climbTypeHint null when the climb-type column is mapped to skip, without invalidating the row", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row()]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      { ...CLIMB_TYPE_MAPPING, sport: "skip" },
      "iso",
      TODAY,
    );
    expect(invalid).toEqual([]);
    expect(valid[0].climbTypeHint).toBeNull();
  });

  it("rejects a row missing climb name or area name", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Climb: "" }), row({ Area: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      "iso",
      TODAY,
    );
    expect(valid).toEqual([]);
    expect(invalid).toHaveLength(2);
  });
});

describe("buildFailedRowsCsv", () => {
  it("outputs the source headers plus an appended reason column", () => {
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], [], []);
    const [header] = csvText.trim().split("\n");
    expect(header).toBe([...SAMPLE_HEADERS, "Import Failure Reason"].join(","));
  });

  it("carries an invalid row's original CSV values through unchanged, including unmapped columns", () => {
    const invalid: InvalidImportRow[] = [
      { rowIndex: 4, raw: row({ Country: "Canada" }), reason: "Missing climb name" },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, invalid, [], []);
    expect(csvText).toContain("I'll Burn the Building Down");
    expect(csvText).toContain("Office Space");
    expect(csvText).toContain("Canada"); // Country isn't used by any wizard field, but must still round-trip
    expect(csvText).toContain("Missing climb name");
  });

  it("includes a not-found row's original values with a human-readable reason", () => {
    const notFound: NotFoundRow[] = [
      {
        climbName: "Ghost Route",
        areaName: "Nowhere",
        dateSent: "2026-01-01",
        reason: "climb-not-found",
        raw: row({ Climb: "Ghost Route", Area: "Nowhere" }),
      },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], notFound, []);
    expect(csvText).toContain("Ghost Route");
    expect(csvText).toContain("Nowhere");
    expect(csvText).toContain("Climb not found");
  });

  it("includes an ambiguous-match reason distinctly from not-found", () => {
    const notFound: NotFoundRow[] = [
      {
        climbName: "Direct",
        areaName: "Big Wall",
        dateSent: null,
        reason: "climb-ambiguous",
        raw: row({ Climb: "Direct", Area: "Big Wall" }),
      },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], notFound, []);
    expect(csvText).toContain("Ambiguous climb match");
  });

  it("includes batch-error rows with the batch's error message", () => {
    const batchErrors: BatchErrorRow[] = [
      {
        message: "Not signed in",
        rows: [
          {
            climbName: "Some Route",
            areaName: "Some Crag",
            climbTypeHint: null,
            ascentStyle: "redpoint",
            dateSent: "2026-01-01",
            rating: 5,
            comment: "Great",
            gradeText: "5.10a",
            raw: row({ Climb: "Some Route", Area: "Some Crag" }),
          },
        ],
      },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], [], batchErrors);
    expect(csvText).toContain("Some Route");
    expect(csvText).toContain("Not attempted: Not signed in");
  });

  it("combines all three buckets into one CSV", () => {
    const invalid: InvalidImportRow[] = [{ rowIndex: 0, raw: row(), reason: "Missing area name" }];
    const notFound: NotFoundRow[] = [
      {
        climbName: "Ghost Route",
        areaName: "Nowhere",
        dateSent: null,
        reason: "climb-not-found",
        raw: row({ Climb: "Ghost Route", Area: "Nowhere" }),
      },
    ];
    const batchErrors: BatchErrorRow[] = [
      {
        message: "network error",
        rows: [
          {
            climbName: "Batch Route",
            areaName: "Batch Crag",
            climbTypeHint: null,
            ascentStyle: "flash",
            dateSent: null,
            rating: null,
            comment: null,
            gradeText: null,
            raw: row({ Climb: "Batch Route", Area: "Batch Crag" }),
          },
        ],
      },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, invalid, notFound, batchErrors);
    const lines = csvText.trim().split("\n");
    expect(lines).toHaveLength(4); // header + 3 data rows
  });

  it("returns just a header row when there's nothing to export", () => {
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], [], []);
    expect(csvText.trim().split("\n")).toHaveLength(1);
  });
});
