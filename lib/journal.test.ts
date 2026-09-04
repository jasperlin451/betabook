import { describe, expect, it } from "vitest";

import { ActionError } from "@/lib/action-result";
import {
  JOURNAL_KINDS,
  JOURNAL_VISIBILITIES,
  MAX_JOURNAL_BODY_LENGTH,
  MAX_JOURNAL_TAGS,
  MAX_JOURNAL_TAG_LENGTH,
  describePendingEntry,
  normalizeTag,
  normalizeTags,
  parseJournalVisibility,
  validateJournalInput,
  type RawJournalEntryInput,
} from "@/lib/journal";

const TODAY = "2026-03-15";

function raw(overrides: Partial<RawJournalEntryInput> = {}): RawJournalEntryInput {
  return {
    kind: "session",
    climbId: "7",
    sent: null,
    entryDate: TODAY,
    body: "Good day out.",
    tags: null,
    ...overrides,
  };
}

describe("normalizeTags", () => {
  it("lowercases, trims and collapses interior whitespace", () => {
    expect(normalizeTags([" Hangboard ", "Max   Hangs"])).toEqual(["hangboard", "max hangs"]);
  });

  it("treats case and whitespace variants as one tag, keeping typed order", () => {
    expect(normalizeTags(["Power", "endurance", "POWER ", " power"])).toEqual([
      "power",
      "endurance",
    ]);
  });

  it("skips blank chips rather than rejecting them", () => {
    expect(normalizeTags(["", "   ", "core"])).toEqual(["core"]);
  });

  it("returns [] for absent tags", () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
  });

  it("dedupes before counting, so more chips than the cap can still pass", () => {
    const chips = Array.from({ length: MAX_JOURNAL_TAGS }, (_, i) => `tag-${i}`);
    expect(normalizeTags([...chips, ...chips.map((t) => t.toUpperCase())])).toHaveLength(
      MAX_JOURNAL_TAGS,
    );
  });

  it("rejects more distinct tags than the cap, naming the count", () => {
    const chips = Array.from({ length: MAX_JOURNAL_TAGS + 1 }, (_, i) => `tag-${i}`);
    expect(() => normalizeTags(chips)).toThrow(`${MAX_JOURNAL_TAGS + 1} tags`);
  });

  it("rejects an over-long tag", () => {
    expect(() => normalizeTags(["x".repeat(MAX_JOURNAL_TAG_LENGTH + 1)])).toThrow(
      `the limit is ${MAX_JOURNAL_TAG_LENGTH}`,
    );
  });

  it("rejects characters outside letters, numbers, spaces and hyphens", () => {
    expect(() => normalizeTags(["power!"])).toThrow("letters, numbers, spaces and hyphens");
  });

  it("rejects a non-array and non-string members", () => {
    expect(() => normalizeTags("hangboard")).toThrow(ActionError);
    expect(() => normalizeTags([42])).toThrow(ActionError);
  });

  it("admits spaces, which is what makes normalizeTag load-bearing on the read side", () => {
    expect(normalizeTags(["Happy Boulders"])).toEqual(["happy boulders"]);
    expect(normalizeTag("Happy  Boulders ")).toBe("happy boulders");
  });
});

describe("validateJournalInput", () => {
  it("accepts an outdoor session associated with a climb", () => {
    expect(validateJournalInput(raw(), TODAY)).toEqual({
      kind: "session",
      climbId: 7,
      sent: false,
      entryDate: TODAY,
      body: "Good day out.",
      tags: null,
    });
  });

  it("stores tags as null when there are none, not as an empty array", () => {
    expect(validateJournalInput(raw({ tags: [] }), TODAY).tags).toBeNull();
  });

  it("accepts a sent session against a climb", () => {
    const input = validateJournalInput(raw({ climbId: "7", sent: "true", body: null }), TODAY);
    expect(input).toMatchObject({ climbId: 7, sent: true, body: null });
  });

  it("rejects an outdoor session without a climb", () => {
    expect(() => validateJournalInput(raw({ climbId: null }), TODAY)).toThrow(
      "Pick a climb for an outdoor session",
    );
  });

  it("rejects a climb on a training entry", () => {
    expect(() => validateJournalInput(raw({ kind: "training", climbId: "7" }), TODAY)).toThrow(
      "Climb-specific entries are sessions, not training",
    );
  });

  it("rejects a sent training entry", () => {
    expect(() =>
      validateJournalInput(raw({ kind: "training", climbId: null, sent: "true" }), TODAY),
    ).toThrow("Training entries can't be marked as sends");
  });

  it("rejects training with neither a note nor a tag", () => {
    expect(() =>
      validateJournalInput(raw({ kind: "training", climbId: null, body: null }), TODAY),
    ).toThrow("Add a note or a tag so this records something");
  });

  it("accepts a training entry carried by tags alone", () => {
    const input = validateJournalInput(
      raw({ kind: "training", climbId: null, body: null, tags: ["hangboard"] }),
      TODAY,
    );
    expect(input).toMatchObject({ kind: "training", body: null, tags: ["hangboard"] });
  });

  it("accepts a session on a climb with no note — working a route records itself", () => {
    expect(validateJournalInput(raw({ climbId: "7", body: null }), TODAY)).toMatchObject({
      climbId: 7,
      body: null,
    });
  });

  it("accepts every stored kind", () => {
    for (const kind of JOURNAL_KINDS) {
      const climbId = kind === "session" ? "7" : null;
      expect(validateJournalInput(raw({ kind, climbId, body: "Notes." }), TODAY).kind).toBe(kind);
    }
  });

  it("rejects an unknown kind", () => {
    expect(() => validateJournalInput(raw({ kind: "projecting" }), TODAY)).toThrow(
      "Invalid entry kind",
    );
  });

  it("accepts a 1,000-character note", () => {
    const body = "x".repeat(1000);
    expect(validateJournalInput(raw({ body }), TODAY).body).toBe(body);
  });

  it("rejects a note over 1,000 characters", () => {
    const body = "x".repeat(MAX_JOURNAL_BODY_LENGTH + 1);
    expect(() => validateJournalInput(raw({ body }), TODAY)).toThrow(
      "Note is 1001 characters — the limit is 1,000",
    );
  });

  it("requires an entry date", () => {
    expect(() => validateJournalInput(raw({ entryDate: "  " }), TODAY)).toThrow(
      "Entry date is required",
    );
  });

  it("rejects a date the calendar doesn't have", () => {
    expect(() => validateJournalInput(raw({ entryDate: "2026-02-30" }), TODAY)).toThrow(
      "Invalid entry date",
    );
  });

  it("tolerates one day past UTC today, for a client at UTC+14", () => {
    expect(validateJournalInput(raw({ entryDate: "2026-03-16" }), TODAY).entryDate).toBe(
      "2026-03-16",
    );
  });

  it("rejects anything beyond that", () => {
    expect(() => validateJournalInput(raw({ entryDate: "2026-03-17" }), TODAY)).toThrow(
      "Entry date can't be in the future",
    );
  });
});

describe("parseJournalVisibility", () => {
  it("accepts every stored value", () => {
    for (const visibility of JOURNAL_VISIBILITIES) {
      expect(parseJournalVisibility(visibility)).toBe(visibility);
    }
  });

  it("rejects anything else", () => {
    expect(() => parseJournalVisibility("friends")).toThrow(ActionError);
    expect(() => parseJournalVisibility(null)).toThrow(ActionError);
  });
});

describe("describePendingEntry", () => {
  it("names training and promises nothing else", () => {
    expect(describePendingEntry({ kind: "training", sent: false, hasPriorSend: false })).toEqual({
      headline: "Logging training.",
      consequence: null,
    });
  });

  it("names a climb-less session as outdoors", () => {
    expect(describePendingEntry({ kind: "session", sent: false, hasPriorSend: false })).toEqual({
      headline: "Logging an outdoor session.",
      consequence: null,
    });
  });

  it("names the climb on an unsent outdoor session, with no consequence", () => {
    expect(
      describePendingEntry({
        kind: "session",
        climbName: "Evilution",
        sent: false,
        hasPriorSend: false,
      }),
    ).toEqual({ headline: "Logging an outdoor session on Evilution.", consequence: null });
  });

  it("warns that an ascent reaches past the journal", () => {
    const { headline, consequence } = describePendingEntry({
      kind: "session",
      climbName: "Evilution",
      sent: true,
      hasPriorSend: false,
    });
    expect(headline).toBe("Logging an ascent of Evilution.");
    expect(consequence).toContain("send total and grade consensus");
  });

  it("says a repeat changes nothing public", () => {
    const { headline, consequence } = describePendingEntry({
      kind: "session",
      climbName: "Evilution",
      sent: true,
      hasPriorSend: true,
    });
    expect(headline).toBe("Logging a repeat of Evilution.");
    expect(consequence).toContain("already recorded");
  });

  it("never says first ascent", () => {
    const states = [true, false].flatMap((sent) =>
      [true, false].map((hasPriorSend) =>
        describePendingEntry({ kind: "session", climbName: "Evilution", sent, hasPriorSend }),
      ),
    );
    for (const state of states) {
      expect(`${state.headline} ${state.consequence ?? ""}`.toLowerCase()).not.toContain(
        "first ascent",
      );
    }
  });
});
