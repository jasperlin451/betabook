import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { EmptyState } from "./empty-state";
const meta = {
  title: "Components/Feedback/Empty state",
  component: EmptyState,
  args: { message: "No sessions match these filters." },
  decorators: [
    (Story) => (
      <StoryPage title="Empty state">
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoResults: Story = {};
export const WithAction: Story = {
  args: { message: "No sends yet.", cta: <Button onPress={() => {}}>Log sample send</Button> },
};
