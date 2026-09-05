import { describe, expect, it } from "vitest";

import { canViewJournal, canViewUser } from "./user-visibility";

describe("canViewUser", () => {
  it("allows anyone to view a public profile", () => {
    expect(canViewUser({ id: "alice", isPrivate: false }, null)).toBe(true);
    expect(canViewUser({ id: "alice", isPrivate: false }, "bob")).toBe(true);
  });

  it("blocks a signed-out viewer from a private profile", () => {
    expect(canViewUser({ id: "alice", isPrivate: true }, null)).toBe(false);
  });

  it("blocks a different signed-in viewer from a private profile", () => {
    expect(canViewUser({ id: "alice", isPrivate: true }, "bob")).toBe(false);
  });

  it("allows the owner to view their own private profile", () => {
    expect(canViewUser({ id: "alice", isPrivate: true }, "alice")).toBe(true);
  });
});

describe("canViewJournal", () => {
  const owner = (isPrivate: boolean, journalVisibility: "private" | "public") => ({
    id: "alice",
    isPrivate,
    journalVisibility,
  });

  it("lets the owner read their own journal, whatever both flags say", () => {
    expect(canViewJournal(owner(false, "private"), "alice")).toBe(true);
    expect(canViewJournal(owner(true, "private"), "alice")).toBe(true);
    expect(canViewJournal(owner(true, "public"), "alice")).toBe(true);
  });

  it("keeps a private journal private", () => {
    expect(canViewJournal(owner(false, "private"), null)).toBe(false);
    expect(canViewJournal(owner(false, "private"), "bob")).toBe(false);
  });

  it("opens a public journal on a public profile", () => {
    expect(canViewJournal(owner(false, "public"), null)).toBe(true);
    expect(canViewJournal(owner(false, "public"), "bob")).toBe(true);
  });

  it("keeps a public journal hidden behind a private profile", () => {
    expect(canViewJournal(owner(true, "public"), null)).toBe(false);
    expect(canViewJournal(owner(true, "public"), "bob")).toBe(false);
  });
});
