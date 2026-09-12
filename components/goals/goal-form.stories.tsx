import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GoalForm } from "./goal-form";
const meta = {
  title: "Components/Goals/Goal form",
  component: GoalForm,
  args: { today: "2026-09-11", nextGrades: { boulder: 6, sport: 6, trad: 6 } },
} satisfies Meta<typeof GoalForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Categories: Story = {};
export const Climbing: Story = { args: { initialCategory: "climbing" } };
export const Training: Story = { args: { initialCategory: "training" } };
export const Recurring: Story = { args: { initialCategory: "training", initialRepeat: "week" } };

export const SeasonalGoal: Story = {
  args: {
    initialCategory: "climbing",
    initialCustomDate: true,
    initialStartDate: "2026-06-01",
    initialEndDate: "2026-11-30",
  },
};

export const NewGrade: Story = { args: { initialCategory: "climbing", initialGoal: "grade" } };
export const Explore: Story = { args: { initialCategory: "explore" } };

export const MinimumGrade: Story = {
  args: {
    initialDraft: {
      category: "climbing",
      goal: "volume",
      discipline: "boulder",
      grade: "5",
      gradeMatch: "at-least",
      amount: "8",
      period: "year",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      repeat: "none",
    },
  },
};
