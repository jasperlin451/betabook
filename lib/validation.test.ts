import { describe, expect, it } from "vitest";

import { parseGradeIndex, pickFormFields, requireTrimmed, trimOrNull } from "./validation";

describe("trimOrNull", () => {
  it("returns null for non-string, empty, or whitespace-only values", () => {
    expect(trimOrNull(null)).toBeNull();
    expect(trimOrNull("")).toBeNull();
    expect(trimOrNull("   ")).toBeNull();
  });

  it("returns the trimmed string otherwise", () => {
    expect(trimOrNull("  hello  ")).toBe("hello");
  });
});

describe("requireTrimmed", () => {
  it("throws '<field> is required' for a missing or blank value", () => {
    expect(() => requireTrimmed(null, "Name")).toThrow("Name is required");
    expect(() => requireTrimmed("   ", "Name")).toThrow("Name is required");
  });

  it("returns the trimmed value otherwise", () => {
    expect(requireTrimmed("  Rifle  ", "Name")).toBe("Rifle");
  });
});

describe("parseGradeIndex", () => {
  it("throws '<field> is required' for a missing value", () => {
    expect(() => parseGradeIndex(null, 10, "Grade")).toThrow("Grade is required");
    expect(() => parseGradeIndex("", 10, "Grade")).toThrow("Grade is required");
  });

  it("throws 'Invalid <field>' for an out-of-bounds or non-integer value", () => {
    expect(() => parseGradeIndex("-1", 10, "Grade")).toThrow("Invalid grade");
    expect(() => parseGradeIndex("10", 10, "Grade")).toThrow("Invalid grade");
    expect(() => parseGradeIndex("1.5", 10, "Grade")).toThrow("Invalid grade");
    expect(() => parseGradeIndex("nope", 10, "Suggested grade")).toThrow("Invalid suggested grade");
  });

  it("returns the parsed index when in bounds", () => {
    expect(parseGradeIndex("5", 10, "Grade")).toBe(5);
  });
});

describe("pickFormFields", () => {
  it("extracts only the requested keys from a FormData", () => {
    const formData = new FormData();
    formData.set("name", "Rifle");
    formData.set("description", "Sport climbing area");
    formData.set("ignored", "not picked");

    expect(pickFormFields(formData, ["name", "description"])).toEqual({
      name: "Rifle",
      description: "Sport climbing area",
    });
  });

  it("returns null for a key not present in the FormData", () => {
    const formData = new FormData();
    expect(pickFormFields(formData, ["name"])).toEqual({ name: null });
  });
});
