import { describe, expect, it, vi } from "vitest";
import {
  ActionError,
  GENERIC_ERROR_MESSAGE,
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

  it("passes an ActionError's message through to ok:false", async () => {
    expect(
      await toActionResult(async () => {
        throw new ActionError("Can't delete a climb with logged sends");
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

  it("logs an unexpected Error and returns the generic message instead of leaking it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const internal = new Error("D1_ERROR: something leaked from the driver");
      expect(
        await toActionResult(async () => {
          throw internal;
        }),
      ).toEqual({ ok: false, error: GENERIC_ERROR_MESSAGE });
      expect(consoleError).toHaveBeenCalledWith(internal);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("returns the generic message for non-Error throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await toActionResult(async () => {
          throw "nope";
        }),
      ).toEqual({ ok: false, error: GENERIC_ERROR_MESSAGE });
    } finally {
      consoleError.mockRestore();
    }
  });
});
