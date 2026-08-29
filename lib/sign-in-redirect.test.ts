import { describe, expect, it } from "vitest";
import { safeNextPath, signInUrl, signUpUrl } from "./sign-in-redirect";

describe("safeNextPath", () => {
  it("accepts same-origin relative paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/account/import")).toBe("/account/import");
    expect(safeNextPath("/climbs/new")).toBe("/climbs/new");
    expect(safeNextPath("/areas/12?sort=grade&dir=desc")).toBe(
      "/areas/12?sort=grade&dir=desc",
    );
  });

  it("rejects absolute URLs", () => {
    expect(safeNextPath("https://evil.com")).toBeUndefined();
    expect(safeNextPath("http://evil.com/account")).toBeUndefined();
    expect(safeNextPath("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects protocol-relative URLs and backslash variants", () => {
    expect(safeNextPath("//evil.com")).toBeUndefined();
    expect(safeNextPath("//evil.com/account")).toBeUndefined();
    expect(safeNextPath("/\\evil.com")).toBeUndefined();
    expect(safeNextPath("/\\/evil.com")).toBeUndefined();
  });

  it("rejects values with control characters that URL parsers strip", () => {
    // new URL("/\t/evil.com", base) strips the tab, yielding //evil.com.
    expect(safeNextPath("/\t/evil.com")).toBeUndefined();
    expect(safeNextPath("/\n/evil.com")).toBeUndefined();
    expect(safeNextPath("/\r/evil.com")).toBeUndefined();
  });

  it("rejects non-strings and non-path strings", () => {
    expect(safeNextPath(undefined)).toBeUndefined();
    expect(safeNextPath(["/account", "/other"])).toBeUndefined();
    expect(safeNextPath("")).toBeUndefined();
    expect(safeNextPath("account")).toBeUndefined();
    expect(safeNextPath("evil.com/account")).toBeUndefined();
  });
});

describe("signInUrl / signUpUrl", () => {
  it("returns the bare route without a continuation", () => {
    expect(signInUrl()).toBe("/sign-in");
    expect(signUpUrl()).toBe("/sign-up");
  });

  it("encodes the continuation into the next param", () => {
    expect(signInUrl("/account/import")).toBe(
      "/sign-in?next=%2Faccount%2Fimport",
    );
    expect(signUpUrl("/climbs/new")).toBe("/sign-up?next=%2Fclimbs%2Fnew");
    expect(signInUrl("/areas/12?sort=grade&dir=desc")).toBe(
      "/sign-in?next=%2Fareas%2F12%3Fsort%3Dgrade%26dir%3Ddesc",
    );
  });
});
