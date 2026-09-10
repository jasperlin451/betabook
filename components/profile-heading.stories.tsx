import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProfileHeading } from "./profile-heading";

const meta = {
  title: "Components/Profile/Heading",
  component: ProfileHeading,
  args: { name: "Alex Morgan", since: 2026 },
} satisfies Meta<typeof ProfileHeading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MemberProfile: Story = {};
