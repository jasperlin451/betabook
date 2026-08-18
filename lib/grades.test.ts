import { describe, expect, it } from "vitest";
import {
  BOULDER_HUECO,
  HUECO_TO_FONT,
  ROPE_YDS,
  YDS_TO_FRENCH,
  formatGrade,
  nativeGradeArray,
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
