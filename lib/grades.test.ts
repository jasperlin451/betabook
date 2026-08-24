import { describe, expect, it } from "vitest";
import {
  BOULDER_HUECO,
  HUECO_TO_FONT,
  ROPE_YDS,
  YDS_TO_FRENCH,
  describeGradeTrend,
  formatGrade,
  nativeGradeArray,
  parseGrade,
} from "./grades";

describe("formatGrade", () => {
  it("returns 'Grade unknown' when grade is null or undefined", () => {
    expect(formatGrade("boulder", null)).toBe("Grade unknown");
    expect(formatGrade("boulder", undefined)).toBe("Grade unknown");
    expect(formatGrade("sport", null)).toBe("Grade unknown");
  });

  it("formats a boulder grade in its native Hueco scale by default", () => {
    expect(formatGrade("boulder", 5)).toBe("V4");
    expect(formatGrade("boulder", 0)).toBe("VB");
  });

  it("formats sport and trad grades in the shared native YDS scale by default", () => {
    expect(formatGrade("sport", 10)).toBe("5.10a");
    expect(formatGrade("trad", 6)).toBe("5.6");
  });

  it("formats a boulder grade in Font when explicitly requested", () => {
    expect(formatGrade("boulder", 5, "font")).toBe(HUECO_TO_FONT[5]);
    expect(formatGrade("boulder", 5, "font")).not.toBe(BOULDER_HUECO[5]);
  });

  it("formats a rope grade in French when explicitly requested", () => {
    expect(formatGrade("sport", 10, "french")).toBe(YDS_TO_FRENCH[10]);
    expect(formatGrade("trad", 10, "french")).toBe(YDS_TO_FRENCH[10]);
  });

  it("returns 'Grade unknown' for an out-of-range grade", () => {
    expect(formatGrade("boulder", 999)).toBe("Grade unknown");
    expect(formatGrade("boulder", -1)).toBe("Grade unknown");
  });

  it("treats sport and trad as the same discipline for grade formatting", () => {
    expect(formatGrade("sport", 12)).toBe(formatGrade("trad", 12));
  });
});

describe("nativeGradeArray", () => {
  it("returns the Hueco array for boulder", () => {
    expect(nativeGradeArray("boulder")).toBe(BOULDER_HUECO);
  });

  it("returns the shared YDS array for both sport and trad", () => {
    expect(nativeGradeArray("sport")).toBe(ROPE_YDS);
    expect(nativeGradeArray("trad")).toBe(ROPE_YDS);
  });
});

describe("grade scale tables", () => {
  it("keeps HUECO_TO_FONT the same length as BOULDER_HUECO", () => {
    expect(HUECO_TO_FONT.length).toBe(BOULDER_HUECO.length);
  });

  it("keeps YDS_TO_FRENCH the same length as ROPE_YDS", () => {
    expect(YDS_TO_FRENCH.length).toBe(ROPE_YDS.length);
  });
});

describe("parseGrade", () => {
  it("parses a native-scale boulder grade", () => {
    expect(parseGrade("boulder", "V4")).toBe(5);
    expect(parseGrade("boulder", "VB")).toBe(0);
  });

  it("parses a native-scale rope grade for sport and trad", () => {
    expect(parseGrade("sport", "5.10a")).toBe(10);
    expect(parseGrade("trad", "5.6")).toBe(6);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseGrade("boulder", "  v4  ")).toBe(5);
  });

  it("parses a converted-scale grade when requested", () => {
    expect(parseGrade("boulder", HUECO_TO_FONT[5], "converted")).toBe(5);
    expect(parseGrade("sport", YDS_TO_FRENCH[10], "converted")).toBe(10);
  });

  it("resolves an ambiguous converted-scale value to its first matching index", () => {
    // YDS_TO_FRENCH has "7a+" at both index 17 and 18 (see grades.ts's own
    // comment about the conversion not being strictly 1:1).
    expect(YDS_TO_FRENCH[17]).toBe("7a+");
    expect(YDS_TO_FRENCH[18]).toBe("7a+");
    expect(parseGrade("sport", "7a+", "converted")).toBe(17);
  });

  it("returns null for text that doesn't match anything in the table", () => {
    expect(parseGrade("boulder", "V99")).toBeNull();
    expect(parseGrade("sport", "not a grade")).toBeNull();
  });

  it("returns null for blank text", () => {
    expect(parseGrade("boulder", "")).toBeNull();
    expect(parseGrade("boulder", "   ")).toBeNull();
  });
});

describe("describeGradeTrend", () => {
  it("shows only the posted grade when there's no suggested-grade data", () => {
    expect(describeGradeTrend("boulder", 5, null)).toEqual({
      postedLabel: "V4",
      suggestedLabel: null,
      arrow: null,
    });
    expect(describeGradeTrend("boulder", null, 5)).toEqual({
      postedLabel: "Grade unknown",
      suggestedLabel: null,
      arrow: null,
    });
  });

  it("shows no arrow or suggested label when the average matches the posted grade exactly", () => {
    expect(describeGradeTrend("boulder", 5, 5)).toEqual({
      postedLabel: "V4",
      suggestedLabel: null,
      arrow: null,
    });
  });

  it("shows a bare arrow (no suggested label) for a lean under the rounding threshold", () => {
    expect(describeGradeTrend("boulder", 5, 5.3)).toEqual({
      postedLabel: "V4",
      suggestedLabel: null,
      arrow: "up",
    });
    expect(describeGradeTrend("boulder", 5, 4.7)).toEqual({
      postedLabel: "V4",
      suggestedLabel: null,
      arrow: "down",
    });
  });

  it("shows a suggested label once the average rounds to a different grade step", () => {
    expect(describeGradeTrend("boulder", 5, 6)).toEqual({
      postedLabel: "V4",
      suggestedLabel: "V5",
      arrow: null,
    });
  });

  it("shows both a suggested label and an arrow when the average leans past the rounded step", () => {
    expect(describeGradeTrend("boulder", 5, 6.3)).toEqual({
      postedLabel: "V4",
      suggestedLabel: "V5",
      arrow: "up",
    });
  });
});
