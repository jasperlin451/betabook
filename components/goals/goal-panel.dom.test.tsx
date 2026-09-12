import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { GoalProgress } from "@/lib/goals";

import { GoalPanel } from "./goal-panel";

vi.mock("@/actions", () => ({
  saveGoal: vi.fn<() => Promise<unknown>>(),
  deleteGoal: vi.fn<() => Promise<unknown>>(),
}));
const goal: GoalProgress = {
  id: 1,
  userId: "owner",
  kind: "training",
  target: 8,
  discipline: null,
  grade: null,
  timeframe: "month",
  repeat: "none",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  timezone: "UTC",
  progress: 2,
  completedDate: null,
};
it("shows a shared journal’s progress without owner actions", () => {
  render(
    <GoalPanel
      ownerId="owner"
      isOwner={false}
      initialActive={{ goals: [goal], hasMore: false }}
      initialCompleted={{ goals: [], hasMore: false }}
      timezone="UTC"
      today="2026-09-11"
    />,
  );
  expect(screen.getByText("Log 8 training sessions")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Set goal" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
});
it("hides empty tabs and opens the real goal form for the owner", async () => {
  const user = userEvent.setup();
  render(
    <GoalPanel
      ownerId="new-owner"
      isOwner
      initialActive={{ goals: [], hasMore: false }}
      initialCompleted={{ goals: [], hasMore: false }}
      timezone="UTC"
      today="2026-09-11"
    />,
  );
  expect(screen.queryByRole("navigation", { name: "Goal views" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Set goal" }));
  expect(
    await screen.findByRole("heading", { name: "What do you want to work on?" }),
  ).toBeVisible();
});

it("switches the completed list and summary together when choosing a year", async () => {
  const { goalPanelStoryArgs } = await import("@/stories/fixtures/goal-samples");
  render(<GoalPanel {...goalPanelStoryArgs} initialView="completed" />);
  const user = userEvent.setup();
  expect(screen.getByText("20 goals achieved")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Achievement year/ }));
  await user.click(screen.getByRole("option", { name: "2025" }));
  expect(await screen.findByText("1 goal achieved")).toBeVisible();
  expect(screen.getByRole("button", { name: "Completed (1)" })).toBeVisible();
});

it("hides the year selector when completed history only has one year", async () => {
  render(
    <GoalPanel
      ownerId="one-year-owner"
      isOwner
      timezone="UTC"
      today="2026-09-11"
      initialView="completed"
      initialActive={{ goals: [], hasMore: false }}
      initialCompleted={{
        goals: [{ ...goal, progress: 8, completedDate: "2026-09-02" }],
        hasMore: false,
        total: 1,
        years: [2026],
        summary: {
          year: 2026,
          achieved: 1,
        },
      }}
    />,
  );
  expect(screen.getByText("1 goal achieved")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Achievement year/ })).not.toBeInTheDocument();
});

it("keeps recurring history exclusively in Completed", async () => {
  const { goalPanelStoryArgs, goalHistorySample } = await import("@/stories/fixtures/goal-samples");
  const weekly = goalPanelStoryArgs.initialActive.goals.find((g) => g.id === 3);
  if (!weekly) throw new Error("Missing weekly goal");
  render(
    <GoalPanel
      {...goalPanelStoryArgs}
      initialActive={{ goals: [weekly], hasMore: false }}
      initialCompleted={{
        goals: [goalHistorySample(3)],
        hasMore: false,
        total: 1,
      }}
    />,
  );
  const user = userEvent.setup();
  expect(screen.getByRole("progressbar")).toBeVisible();
  expect(screen.queryByRole("button", { name: "See history" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Completed (1)" }));
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "See history" }));
  expect(screen.getByRole("button", { name: /Week of Aug 24/ })).toBeVisible();
});

it("shows the next celebration after dismissing the first goal met today", async () => {
  const first = {
    ...goal,
    id: 101,
    userId: "celebration-owner",
    target: 1,
    progress: 1,
    completedDate: "2026-09-11",
  };
  const second = { ...first, id: 102, target: 2, progress: 2 };
  render(
    <GoalPanel
      ownerId="celebration-owner"
      isOwner
      timezone="UTC"
      today="2026-09-11"
      initialActive={{ goals: [], hasMore: false }}
      initialCompleted={{ goals: [first, second], hasMore: false }}
    />,
  );
  const user = userEvent.setup();
  await screen.findByRole("button", { name: "Dismiss achievement" });
  await user.click(screen.getByRole("button", { name: "Dismiss achievement" }));
  expect(screen.getByRole("status")).toHaveTextContent("Log 2 training sessions");
  await user.click(screen.getByRole("button", { name: "Dismiss achievement" }));
  expect(screen.queryByRole("button", { name: "Dismiss achievement" })).not.toBeInTheDocument();
});
