import { describe, expect, it } from "vitest";
import {
  NotSignedInError,
  SESSION_EXPIRED_MESSAGE,
  toActionResult,
} from "./action-result";

describe("toActionResult", () => {
  it("wraps a successful body's return value in ok:true", async () => {
    expect(await toActionResult(async () => 42)).toEqual({ ok: true, value: 42 });
  });

  it("wraps a void body in ok:true", async () => {
    expect(await toActionResult(async () => {})).toEqual({ ok: true, value: undefined });
  });

  it("converts a thrown Error into ok:false with its message", async () => {
    expect(
      await toActionResult(async () => {
        throw new Error("Can't delete a climb with logged sends");
      }),
    ).toEqual({ ok: false, error: "Can't delete a climb with logged sends" });
  });

  it("maps a missing session to the friendly expired-session message", async () => {
    expect(
      await toActionResult(async () => {
        throw new NotSignedInError();
      }),
    ).toEqual({ ok: false, error: SESSION_EXPIRED_MESSAGE });
  });

  it("falls back to a generic message for non-Error throws", async () => {
    expect(
      await toActionResult(async () => {
        throw "nope";
      }),
    ).toEqual({ ok: false, error: "Something went wrong" });
  });
});
