import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProfileHeading } from "./profile-heading";
import { ProfileTabs } from "./profile-tabs";

const meta = {
  title: "Components/Profile/Sections",
  component: ProfileTabs,
  args: { userId: "sample", showJournal: true, showProjects: true, isOwner: true },
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-4">
        <ProfileHeading name="Alex Morgan" since={2026} />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileTabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Journal: Story = {
  parameters: { nextjs: { navigation: { pathname: "/users/sample" } } },
};
export const OtherClimber: Story = {
  args: { isOwner: false, showProjects: false },
  parameters: { nextjs: { navigation: { pathname: "/users/sample/journal" } } },
};
