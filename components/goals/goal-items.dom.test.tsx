import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { GoalContribution } from "@/lib/goals";
import { goalPanelStoryArgs } from "@/stories/fixtures/goal-samples";

import { GoalItems } from "./goal-items";

it("shows completed climb names without links", async () => {
  const goal = goalPanelStoryArgs.initialCompleted.goals.find((g) => g.kind === "volume");
  if (!goal) throw new Error("Missing completed volume goal");
  render(<GoalItems ownerId="story-goals" goal={goal} loadItems={goalPanelStoryArgs.loadItems} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "5 climbs" }));
  expect(await screen.findByText("Cedar Arete")).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("ignores an older details response after closing and reopening history", async () => {
  const goal = goalPanelStoryArgs.initialCompleted.goals.find((g) => g.kind === "volume");
  if (!goal) throw new Error("Missing volume fixture");
  let resolveOld: (items: GoalContribution[]) => void = () => {
    throw new Error("Request not initialized");
  };
  const old = new Promise<GoalContribution[]>((resolve) => {
    resolveOld = resolve;
  });
  const load = vi
    .fn<() => Promise<GoalContribution[]>>()
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce([{ id: 2, name: "Current climb", type: "climb" }]);
  render(<GoalItems ownerId="story-goals" goal={goal} loadItems={load} />);
  const user = userEvent.setup();
  const disclosure = screen.getByRole("button", { name: "5 climbs" });
  await user.click(disclosure);
  await user.click(disclosure);
  await user.click(disclosure);
  expect(await screen.findByText("Current climb")).toBeVisible();
  await act(async () => {
    resolveOld([{ id: 1, name: "Stale climb", type: "climb" }]);
  });
  expect(screen.queryByText("Stale climb")).not.toBeInTheDocument();
  expect(screen.getByText("Current climb")).toBeVisible();
});
