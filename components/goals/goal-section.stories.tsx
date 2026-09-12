import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CirclePlus } from "lucide-react";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { GoalSection } from "./goal-section";

const meta = {
  title: "Components/Goals/Goal section",
  decorators: [
    (Story) => (
      <StoryPage title="Goals">
        <Story />
      </StoryPage>
    ),
  ],
  component: GoalSection,
  args: {
    title: "Your goals",
    hasGoals: true,
    activeCount: 2,
    expanded: true,
    onExpandedChange: () => {},
  },
  render: function Render(args) {
    const [expanded, setExpanded] = useState(args.expanded);
    return (
      <GoalSection
        {...args}
        expanded={expanded}
        onExpandedChange={setExpanded}
        action={
          <Button className="gap-2">
            <CirclePlus aria-hidden="true" className="size-5" />
            Set goal
          </Button>
        }
      >
        <p className="text-sm">Log 8 training sessions</p>
      </GoalSection>
    );
  },
} satisfies Meta<typeof GoalSection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Expanded: Story = {};
export const Collapsed: Story = { args: { expanded: false } };
export const Empty: Story = { args: { hasGoals: false, activeCount: 0 } };
