import { CircleCheckBig } from "lucide-react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ClimbLogRow } from "@/components/climb-log-row";
import { JournalEntryRow } from "@/components/journal/journal-entry-row";
import { AppLink } from "@/components/ui/app-link";
import { ListRow } from "@/components/ui/list-row";
import type { JournalEntry } from "@/db/queries";
import { DEFAULT_JOURNAL_FILTER } from "@/lib/journal-filter";

vi.mock("@/components/ui/app-link", () => ({
  AppLink: vi.fn<(props: { children?: ReactNode }) => null>(() => null),
}));

const entry: JournalEntry = {
  id: 1,
  climbId: 2,
  kind: "session",
  sent: false,
  entryDate: "2026-09-04",
  body: "Worked the top move.",
  tags: ["slab"],
  climbName: "Long Mobile Climb Name",
  climbType: "boulder",
  climbGrade: 5,
  areaId: 3,
  areaName: "Granite Canyon",
  isAscent: false,
};

function row(filter = DEFAULT_JOURNAL_FILTER, currentEntry = entry) {
  return JournalEntryRow({
    entry: currentEntry,
    isOwner: true,
    userId: "owner",
    filter,
    areaBreadcrumbs: {},
  }) as ReactElement<{
    areaBreadcrumbs: Record<number, { id: number; name: string }[]>;
    climb: { id: number; name: string; areaId: number; areaName: string };
    date: string;
    grade: ReactNode;
    status: ReactNode;
    tags: ReactNode;
  }>;
}

function tagChildren(result: ReturnType<typeof row>) {
  if (!isValidElement<{ children: ReactNode }>(result.props.tags)) return [];
  return flattenNodes(result.props.tags.props.children);
}

function flattenNodes(node: ReactNode): ReactNode[] {
  return Array.isArray(node) ? node.flatMap(flattenNodes) : [node];
}

describe("JournalEntryRow", () => {
  it("links tag chips to the journal tag filter", () => {
    const result = row();
    const tag = tagChildren(result).find(
      (child) => isValidElement(child) && child.type === AppLink,
    );

    expect(isValidElement<{ href: string }>(tag) && tag.props.href).toBe(
      "/users/owner/journal?tag=slab",
    );
  });

  it("lets the active tag chip clear its filter", () => {
    const result = row({ ...DEFAULT_JOURNAL_FILTER, tag: "slab" });
    const tag = tagChildren(result).find(
      (child) => isValidElement(child) && child.type === AppLink,
    );

    expect(isValidElement<{ href: string }>(tag) && tag.props.href).toBe("/users/owner/journal");
  });

  it("uses the shared climb log row for route entries", () => {
    const result = row();
    expect(result.type).toBe(ClimbLogRow);
    expect(result.props.climb).toEqual({
      id: 2,
      name: "Long Mobile Climb Name",
      areaId: 3,
      areaName: "Granite Canyon",
    });
    expect(result.props.date).toBe("2026-09-04");

    const sharedRow = ClimbLogRow({
      ...result.props,
      areaBreadcrumbs: { 3: [{ id: 1, name: "Mountain Range" }] },
    }) as ReactElement<{ subtitle: ReactNode }>;
    expect(sharedRow.type).toBe(ListRow);
    expect(isValidElement(sharedRow.props.subtitle) && sharedRow.props.subtitle.type).toBe(
      AreaBreadcrumb,
    );
  });

  it("marks sends with a check beside the date instead of a chip", () => {
    const result = row(DEFAULT_JOURNAL_FILTER, { ...entry, sent: true, isAscent: true });
    const marker = result.props.status;

    expect(
      isValidElement<{ children: ReactNode }>(marker) &&
        flattenNodes(marker.props.children).some(
          (child) => isValidElement(child) && child.type === CircleCheckBig,
        ),
    ).toBe(true);
    expect(
      tagChildren(result).some(
        (child) =>
          isValidElement<{ children?: ReactNode }>(child) && child.props.children === "Send",
      ),
    ).toBe(false);
  });
});
