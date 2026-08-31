import { describe, expect, it } from "vitest";
import {
  buildFailedRowsCsv,
  detectDateFormat,
  distinctValues,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessColumnMapping,
  guessGradeFeelMapping,
  missingRequiredColumns,
  needsDateFormatChoice,
  normalizeImportRows,
  parseCsvText,
  parseDateWithFormat,
  type AscentStyleMapping,
  type BatchErrorRow,
  type ClimbTypeMapping,
  type ColumnMapping,
  type DateFormat,
  type GradeFeelMapping,
  type InvalidImportRow,
  type NotFoundRow,
  type ParsedCsv,
} from "./sends-import";
import { MAX_COMMENT_LENGTH } from "./sends";

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
  suggestedGrade: null,
  gradeFeel: null,
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

const GRADE_FEEL_MAPPING: GradeFeelMapping = {
  Low: "low",
  Solid: "solid",
  High: "high",
};

const TODAY = "2026-08-19";

function csv(rows: Record<string, string>[]): ParsedCsv {
  return { headers: SAMPLE_HEADERS, rows, warnings: [] };
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
    expect(parseCsvText("")).toEqual({ headers: [], rows: [], warnings: [] });
  });

  it("parses quoted fields containing commas", () => {
    const text = 'Climb,Comments\n"My Route","Great, fun climb"';
    const parsed = parseCsvText(text);
    expect(parsed.rows[0].Comments).toBe("Great, fun climb");
  });

  it("reports no warnings for a well-formed file", () => {
    const text = "Climb,Area\nMy Route,My Crag";
    expect(parseCsvText(text).warnings).toEqual([]);
  });

  it("surfaces parser errors as warnings instead of dropping them", () => {
    const text = 'a,b\n"unterminated,2';
    const parsed = parseCsvText(text);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatch(/Row 2: .*unterminated/i);
  });

  it("renames duplicate headers deterministically and warns about each", () => {
    const text = "Grade,Grade,Notes\nV1,V2,ok";
    const parsed = parseCsvText(text);
    expect(parsed.headers).toEqual(["Grade", "Grade (2)", "Notes"]);
    expect(parsed.rows[0]).toEqual({ Grade: "V1", "Grade (2)": "V2", Notes: "ok" });
    expect(parsed.warnings).toEqual(['Duplicate column "Grade" renamed to "Grade (2)"']);
  });

  it("never renames a duplicate onto a name another column already holds", () => {
    const text = "Grade,Grade,Grade (2)\na,b,c";
    const parsed = parseCsvText(text);
    expect(parsed.headers).toEqual(["Grade", "Grade (3)", "Grade (2)"]);
    expect(parsed.rows[0]).toEqual({ Grade: "a", "Grade (3)": "b", "Grade (2)": "c" });
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
      suggestedGrade: null,
      gradeFeel: null,
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

  it("maps a 'Grade Feel' or 'Feel' header to gradeFeel", () => {
    expect(guessColumnMapping(["Grade Feel"]).gradeFeel).toBe("Grade Feel");
    expect(guessColumnMapping(["Feel"]).gradeFeel).toBe("Feel");
  });

  it("maps Suggested Grade separately from Grade", () => {
    const mapping = guessColumnMapping(["Grade", "Suggested Grade"]);
    expect(mapping.grade).toBe("Grade");
    expect(mapping.suggestedGrade).toBe("Suggested Grade");
  });

  it("auto-maps every column of a betabook export", () => {
    const mapping = guessColumnMapping([
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
    ]);
    expect(mapping).toEqual({
      date: "Date Sent",
      ascentStyle: "Ascent Style",
      climbName: "Climb Name",
      areaName: "Area Name",
      climbType: "Climb Type",
      grade: "Grade",
      suggestedGrade: "Suggested Grade",
      gradeFeel: "Grade Feel",
      rating: "Rating",
      comment: "Comment",
    });
  });
});

describe("missingRequiredColumns", () => {
  it("returns nothing when all required fields are mapped", () => {
    expect(missingRequiredColumns(FULL_MAPPING)).toEqual([]);
  });

  it("names each unmapped required field so the columns step can block Next", () => {
    expect(
      missingRequiredColumns({ ...FULL_MAPPING, ascentStyle: null, areaName: null }),
    ).toEqual(["ascentStyle", "areaName"]);
  });

  it("ignores unmapped optional fields", () => {
    expect(
      missingRequiredColumns({ ...FULL_MAPPING, date: null, grade: null, rating: null }),
    ).toEqual([]);
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

  it("returns null for an all-numeric date the chosen format can't read", () => {
    // Nothing in the value says whether this is Aug 12th or Dec 8th, and the
    // user said their file is ISO, so it's a failed row rather than a guess.
    expect(parseDateWithFormat("8/12/2026", "iso")).toBeNull();
  });

  it("parses unambiguous formats whatever the chosen format is", () => {
    for (const format of ["iso", "mdy", "dmy"] as const) {
      // JS Date#toString, which is what a naively serialized Date looks like.
      expect(
        parseDateWithFormat("Tue Oct 15 2019 00:00:00 GMT+0000 (GMT+00:00)", format),
      ).toBe("2019-10-15");
      expect(parseDateWithFormat("2026-08-12", format)).toBe("2026-08-12");
      expect(parseDateWithFormat("Oct 15, 2019", format)).toBe("2019-10-15");
    }
  });

  it("parses the timestamp shapes exports tend to emit", () => {
    const cases: [string, string][] = [
      ["Tue Oct 15 2019 00:00:00 GMT+0000 (GMT+00:00)", "2019-10-15"],
      ["Sat Mar 07 2020 13:45:02 GMT-0800 (Pacific Standard Time)", "2020-03-07"],
      ["Sun Sep 22 2019 00:00:00 GMT+0000 (GMT+00:00)", "2019-09-22"],
      ["Tue, 15 Oct 2019 00:00:00 GMT", "2019-10-15"], // RFC 1123 / toUTCString
      ["Tue, Oct 15 2019 00:00:00 GMT+0000", "2019-10-15"], // punctuated weekday
      ["2019-10-15T00:00:00.000Z", "2019-10-15"],
      ["2019-10-15T23:30:00-07:00", "2019-10-15"], // civil date as written, not shifted to UTC
      ["2019-10-15 00:00:00", "2019-10-15"],
      ["10/15/2019 2:05 PM", "2019-10-15"],
    ];
    for (const [raw, expected] of cases) {
      expect(parseDateWithFormat(raw, "mdy"), raw).toBe(expected);
    }
  });

  it("parses named-month and non-slash numeric formats", () => {
    const cases: [string, DateFormat, string][] = [
      ["October 15, 2019", "iso", "2019-10-15"],
      ["oct 15 2019", "iso", "2019-10-15"],
      ["Sept 15, 2019", "iso", "2019-09-15"],
      ["15 October 2019", "iso", "2019-10-15"],
      ["15-Oct-2019", "iso", "2019-10-15"], // Excel's text-date rendering
      ["2019/10/15", "iso", "2019-10-15"],
      ["20191015", "iso", "2019-10-15"], // ISO 8601 basic
      ["2019-1-5", "iso", "2019-01-05"], // unpadded
      ["15.10.2019", "dmy", "2019-10-15"], // European dotted
      ["10-15-2019", "mdy", "2019-10-15"],
      ["10/15/19", "mdy", "2019-10-15"], // two-digit year
      ["15/10/19", "dmy", "2019-10-15"],
      ["15-10-19", "dmy", "2019-10-15"], // must not be read as ISO year 15
      ["10/15/89", "mdy", "1989-10-15"], // two-digit years pivot like a spreadsheet's
    ];
    for (const [raw, format, expected] of cases) {
      expect(parseDateWithFormat(raw, format), raw).toBe(expected);
    }
  });

  it("rejects values that only look like dates", () => {
    expect(parseDateWithFormat("2019-10-15 extra", "iso")).toBeNull();
    expect(parseDateWithFormat("Oct 2019", "iso")).toBeNull();
    expect(parseDateWithFormat("last Tuesday", "iso")).toBeNull();
    expect(parseDateWithFormat("43753", "iso")).toBeNull(); // Excel serial number
    expect(parseDateWithFormat("2019-02-30", "iso")).toBeNull();
    expect(parseDateWithFormat("Feb 30, 2019", "iso")).toBeNull();
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

  it("lets the all-numeric values decide when unambiguous values are mixed in", () => {
    expect(
      detectDateFormat(["Tue Oct 15 2019 00:00:00 GMT+0000 (GMT+00:00)", "25/8/2026"]),
    ).toBe("dmy");
  });
});

describe("needsDateFormatChoice", () => {
  it("doesn't ask about a column of JS Date#toString values", () => {
    expect(
      needsDateFormatChoice([
        "Sun Sep 22 2019 00:00:00 GMT+0000 (GMT+00:00)",
        "Tue Oct 15 2019 00:00:00 GMT-0700 (Pacific Daylight Time)",
      ]),
    ).toBe(false);
  });

  it("doesn't ask about ISO or named-month dates", () => {
    expect(needsDateFormatChoice(["2026-08-12", "Oct 15, 2019", "15 October 2019"])).toBe(false);
  });

  it("asks when a value reads as two different dates", () => {
    expect(needsDateFormatChoice(["05/06/2019"])).toBe(true);
  });

  it("doesn't ask when the numbers themselves settle the order", () => {
    // 25 can't be a month, so only "day first" parses it — detectDateFormat
    // gets that right on its own.
    expect(needsDateFormatChoice(["25/8/2026", "26/8/2026"])).toBe(false);
  });

  it("asks as soon as one value in the column is ambiguous", () => {
    expect(needsDateFormatChoice(["2026-08-12", "05/06/2019"])).toBe(true);
  });

  it("ignores blanks and values that aren't dates at all", () => {
    expect(needsDateFormatChoice(["", "   ", "banana"])).toBe(false);
  });
});

describe("normalizeImportRows", () => {
  it("normalizes a fully-populated valid row", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row()]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
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
        blankGradeMeans: "posted-grade",
        gradeFeel: "solid",
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
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
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
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toMatch(/unparseable date/i);
  });

  it("normalizes a serialized-Date timestamp to its civil date", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "Tue Oct 15 2019 00:00:00 GMT+0000 (GMT+00:00)" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].dateSent).toBe("2019-10-15");
  });

  it("rejects a date two days past UTC today", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "2026-08-21" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toMatch(/future/i);
  });

  it("accepts a date equal to UTC today", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: TODAY })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].dateSent).toBe(TODAY);
  });

  it("accepts a date one day past UTC today (a UTC+14 client's local today)", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Date: "2026-08-20" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].dateSent).toBe("2026-08-20");
  });

  it("rejects an unmapped ascent-style value", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ "Send Type": "attempt" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
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
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("truncates an over-length comment instead of rejecting the row", () => {
    const longComment = "a".repeat(MAX_COMMENT_LENGTH + 20);
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Comments: longComment })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].comment).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it("treats blank optional fields as null", () => {
    const { valid } = normalizeImportRows(
      csv([row({ Grade: "", Rating: "", Comments: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
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
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].climbTypeHint).toBeNull();
  });

  it("resolves a Grade Feel value through the grade-feel mapping", () => {
    const mappingWithFeel: ColumnMapping = { ...FULL_MAPPING, gradeFeel: "Grade Feel" };
    const { valid } = normalizeImportRows(
      { headers: [...SAMPLE_HEADERS, "Grade Feel"], rows: [row({ "Grade Feel": "High" })], warnings: [] },
      mappingWithFeel,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid[0].gradeFeel).toBe("high");
  });

  it("defaults gradeFeel to solid when the CSV has no matching column", () => {
    const { valid } = normalizeImportRows(csv([row()]), FULL_MAPPING, ASCENT_STYLE_MAPPING, CLIMB_TYPE_MAPPING, GRADE_FEEL_MAPPING, "iso", { today: TODAY });
    expect(valid[0].gradeFeel).toBe("solid");
  });

  it("defaults gradeFeel to solid for an unmapped value, without invalidating the row", () => {
    const mappingWithFeel: ColumnMapping = { ...FULL_MAPPING, gradeFeel: "Grade Feel" };
    const { valid, invalid } = normalizeImportRows(
      { headers: [...SAMPLE_HEADERS, "Grade Feel"], rows: [row({ "Grade Feel": "medium" })], warnings: [] },
      mappingWithFeel,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].gradeFeel).toBe("solid");
  });

  it("falls back to solid when a grade feel value is explicitly skipped", () => {
    const mappingWithFeel: ColumnMapping = { ...FULL_MAPPING, gradeFeel: "Grade Feel" };
    const { valid, invalid } = normalizeImportRows(
      { headers: [...SAMPLE_HEADERS, "Grade Feel"], rows: [row({ "Grade Feel": "High" })], warnings: [] },
      mappingWithFeel,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      { ...GRADE_FEEL_MAPPING, High: "skip" },
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].gradeFeel).toBe("solid");
  });

  it("rejects a row missing climb name or area name", () => {
    const { valid, invalid } = normalizeImportRows(
      csv([row({ Climb: "" }), row({ Area: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toEqual([]);
    expect(invalid).toHaveLength(2);
  });
});

describe("normalizeImportRows suggested-grade semantics", () => {
  const HEADERS_WITH_SUGGESTED = [...SAMPLE_HEADERS, "Suggested Grade"];
  const MAPPING_WITH_SUGGESTED: ColumnMapping = {
    ...FULL_MAPPING,
    suggestedGrade: "Suggested Grade",
  };

  function csvWithSuggested(rows: Record<string, string>[]): ParsedCsv {
    return { headers: HEADERS_WITH_SUGGESTED, rows, warnings: [] };
  }

  it("prefers a mapped Suggested Grade column over the Grade column", () => {
    const { valid, invalid } = normalizeImportRows(
      csvWithSuggested([row({ Grade: "5.11c", "Suggested Grade": "5.12a" })]),
      MAPPING_WITH_SUGGESTED,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toEqual([]);
    expect(valid[0].gradeText).toBe("5.12a");
    expect(valid[0].blankGradeMeans).toBe("no-suggestion");
  });

  it("treats a blank Suggested Grade cell as no suggestion, not as the Grade column's value", () => {
    const { valid } = normalizeImportRows(
      csvWithSuggested([row({ Grade: "5.11c", "Suggested Grade": "" })]),
      MAPPING_WITH_SUGGESTED,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid[0].gradeText).toBeNull();
    expect(valid[0].blankGradeMeans).toBe("no-suggestion");
  });

  it("keeps posted-grade fallback semantics when only a Grade column is mapped", () => {
    const { valid } = normalizeImportRows(
      csv([row({ Grade: "" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid[0].gradeText).toBeNull();
    expect(valid[0].blankGradeMeans).toBe("posted-grade");
  });
});

describe("normalizeImportRows coercion warnings", () => {
  it("returns no warnings for clean rows", () => {
    const { warnings } = normalizeImportRows(
      csv([row()]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(warnings).toEqual([]);
  });

  it("counts invalid ratings without invalidating the rows, with example rows", () => {
    const { valid, warnings } = normalizeImportRows(
      csv([row({ Rating: "6" }), row({ Rating: "banana" }), row({ Rating: "4" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toHaveLength(3);
    expect(valid[0].rating).toBeNull();
    expect(valid[2].rating).toBe(4);
    const warning = warnings.find((w) => w.field === "rating");
    expect(warning?.count).toBe(2);
    expect(warning?.examples).toEqual(['Row 1: "6"', 'Row 2: "banana"']);
  });

  it("warns on a grade that doesn't parse for the hinted climb type", () => {
    const { valid, warnings } = normalizeImportRows(
      csv([row({ Grade: "V4" })]), // hinted sport via the Climb Type column
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid).toHaveLength(1);
    const warning = warnings.find((w) => w.field === "suggestedGrade");
    expect(warning?.count).toBe(1);
    expect(warning?.examples).toEqual(['Row 1: "V4"']);
  });

  it("without a climb-type hint, warns only when the grade parses in no discipline", () => {
    const skipAllTypes: ClimbTypeMapping = { boulder: "skip", sport: "skip", trad: "skip" };
    const { warnings } = normalizeImportRows(
      csv([row({ Grade: "V4" }), row({ Grade: "5.11c" }), row({ Grade: "nonsense" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      skipAllTypes,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    const warning = warnings.find((w) => w.field === "suggestedGrade");
    expect(warning?.count).toBe(1);
    expect(warning?.examples).toEqual(['Row 3: "nonsense"']);
  });

  it("checks grade parseability against the chosen grade-scale preference", () => {
    const { warnings } = normalizeImportRows(
      csv([row({ Grade: "7a" })]), // French sport grade
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY, gradeScalePreference: "converted" },
    );
    expect(warnings).toEqual([]);
  });

  it("warns on a grade feel value that isn't mapped and defaults to solid", () => {
    const mappingWithFeel: ColumnMapping = { ...FULL_MAPPING, gradeFeel: "Grade Feel" };
    const { valid, warnings } = normalizeImportRows(
      {
        headers: [...SAMPLE_HEADERS, "Grade Feel"],
        rows: [row({ "Grade Feel": "medium" }), row({ "Grade Feel": "High" })],
        warnings: [],
      },
      mappingWithFeel,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(valid[0].gradeFeel).toBe("solid");
    expect(valid[1].gradeFeel).toBe("high");
    const warning = warnings.find((w) => w.field === "gradeFeel");
    expect(warning?.count).toBe(1);
    expect(warning?.examples).toEqual(['Row 1: "medium"']);
  });

  it("counts truncated comments with the original length as the example", () => {
    const { warnings } = normalizeImportRows(
      csv([row({ Comments: "a".repeat(MAX_COMMENT_LENGTH + 20) })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    const warning = warnings.find((w) => w.field === "comment");
    expect(warning?.count).toBe(1);
    expect(warning?.examples).toEqual([`Row 1: ${MAX_COMMENT_LENGTH + 20} characters`]);
  });

  it("caps examples at 3 while still counting every affected row", () => {
    const { warnings } = normalizeImportRows(
      csv([1, 2, 3, 4, 5].map(() => row({ Rating: "99" }))),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    const warning = warnings.find((w) => w.field === "rating");
    expect(warning?.count).toBe(5);
    expect(warning?.examples).toHaveLength(3);
  });

  it("doesn't count warnings for rows that are already invalid", () => {
    const { invalid, warnings } = normalizeImportRows(
      csv([row({ Climb: "", Rating: "banana" })]),
      FULL_MAPPING,
      ASCENT_STYLE_MAPPING,
      CLIMB_TYPE_MAPPING,
      GRADE_FEEL_MAPPING,
      "iso",
      { today: TODAY },
    );
    expect(invalid).toHaveLength(1);
    expect(warnings).toEqual([]);
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
            blankGradeMeans: "posted-grade",
            gradeFeel: "solid",
            raw: row({ Climb: "Some Route", Area: "Some Crag" }),
          },
        ],
      },
    ];
    const csvText = buildFailedRowsCsv(SAMPLE_HEADERS, [], [], batchErrors);
    expect(csvText).toContain("Some Route");
    expect(csvText).toContain("Not imported: Not signed in");
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
            blankGradeMeans: "posted-grade",
            gradeFeel: "solid",
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

describe("distinctValues", () => {
  it("returns an empty array when the column is null", () => {
    expect(distinctValues([{ Type: "flash" }], null)).toEqual([]);
  });

  it("returns each distinct, trimmed, non-blank value in the column", () => {
    const rows = [{ Type: "flash" }, { Type: " redpoint " }, { Type: "flash" }, { Type: "  " }];
    expect(distinctValues(rows, "Type")).toEqual(["flash", "redpoint"]);
  });
});

describe("guessAscentStyleMapping", () => {
  it("maps values that match a known ascent style, case-insensitively", () => {
    expect(guessAscentStyleMapping(["Flash", "redpoint"])).toEqual({
      Flash: "flash",
      redpoint: "redpoint",
    });
  });

  it("maps unrecognized values to 'skip'", () => {
    expect(guessAscentStyleMapping(["nonsense"])).toEqual({ nonsense: "skip" });
  });
});

describe("guessClimbTypeMapping", () => {
  it("maps values that match a known climb type, case-insensitively", () => {
    expect(guessClimbTypeMapping(["Boulder", "sport"])).toEqual({
      Boulder: "boulder",
      sport: "sport",
    });
  });

  it("maps unrecognized values to 'skip'", () => {
    expect(guessClimbTypeMapping(["nonsense"])).toEqual({ nonsense: "skip" });
  });
});

describe("guessGradeFeelMapping", () => {
  it("maps values that match a known grade feel, case-insensitively", () => {
    expect(guessGradeFeelMapping(["Low", "solid", "HIGH"])).toEqual({
      Low: "low",
      solid: "solid",
      HIGH: "high",
    });
  });

  it("maps the common soft/stiff phrasings other sites use", () => {
    expect(guessGradeFeelMapping(["Soft", "stiff", "Hard", "easy"])).toEqual({
      Soft: "low",
      stiff: "high",
      Hard: "high",
      easy: "low",
    });
  });

  it("maps unrecognized values to 'skip'", () => {
    expect(guessGradeFeelMapping(["nonsense"])).toEqual({ nonsense: "skip" });
  });

  it("leaves ambiguous jargon like 'sandbagged' for the user to map", () => {
    expect(guessGradeFeelMapping(["sandbagged"])).toEqual({ sandbagged: "skip" });
  });
});
