import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ClimbJournalCard } from "@/components/journal/climb-journal-card";
import type { JournalEntry } from "@/db/queries";

vi.mock("@/components/ui/app-link", () => ({
  AppLink: ({ children }: { children?: ReactNode }) => children,
}));

function strings(node: ReactNode): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(strings);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return strings(node.props.children);
}

describe("ClimbJournalCard", () => {
  it("labels the ascent entry as Sent", () => {
    const entry: JournalEntry = {
      id: 1,
      climbId: 2,
      kind: "session",
      sent: true,
      entryDate: "2026-09-04",
      body: null,
      tags: [],
      climbName: "Test Climb",
      climbType: "boulder",
      climbGrade: 5,
      areaId: 3,
      areaName: "Test Area",
      isAscent: true,
    };

    const result = ClimbJournalCard({
      userId: "owner",
      climbId: 2,
      entries: [entry],
      hasSend: true,
    });

    expect(strings(result)).toContain("Sent");
    expect(strings(result)).not.toContain("Send");
  });
});
