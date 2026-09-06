import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatTiles } from "@/components/analytics-stat-tiles";
import { ProfileHeading } from "@/components/profile-heading";
import { StoryPage } from "@/stories/fixtures/story-layout";

const meta = { title: "Patterns/Profile overview", component: StoryPage } satisfies Meta<
  typeof StoryPage
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const Profile: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ProfileHeading
        name="Alexandra Rivera"
        since={2019}
        action={<Button variant="outline">Edit sample profile</Button>}
      />
      <StatTiles
        className="sm:grid-cols-3"
        tiles={[
          { label: "Sends", value: 128, sub: "All disciplines" },
          { label: "Days outside", value: 42 },
          { label: "Hardest boulder", value: "V8" },
        ]}
      />
    </div>
  ),
};
