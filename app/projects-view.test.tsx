import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ProjectsView } from "@/app/users/[id]/projects-view";

const mocks = vi.hoisted(() => ({
  getOpenProjects: vi.fn<() => Promise<Array<{ climbId: number }>>>(),
  OpenProjectList: vi.fn<(props: { projects: unknown[] }) => null>(() => null),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn<() => Promise<Record<string, never>>>(async () => ({})),
}));

vi.mock("@/db/queries", () => ({
  getOpenProjects: mocks.getOpenProjects,
}));

vi.mock("@/components/journal", () => ({
  OpenProjectList: mocks.OpenProjectList,
}));

const owner = {
  id: "journal-owner",
  isPrivate: false,
  journalVisibility: "private" as const,
};

describe("ProjectsView", () => {
  it("renders every open project for the owner", async () => {
    const projects = [{ climbId: 1 }, { climbId: 2 }];
    mocks.getOpenProjects.mockResolvedValue(projects);

    const result = (await ProjectsView({ owner })) as ReactElement<{ children: ReactNode }>;
    const children = result.props.children as ReactNode[];
    const list = children.find(
      (child) => isValidElement(child) && child.type === mocks.OpenProjectList,
    );

    expect(mocks.getOpenProjects).toHaveBeenCalledWith({}, owner, owner.id);
    expect(isValidElement<{ projects: unknown[] }>(list) && list.props.projects).toBe(projects);
  });
});
