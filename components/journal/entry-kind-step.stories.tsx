import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { EntryKindStep } from "./entry-kind-step";

const meta = {
  title: "Components/Journal/Entry kind",
  component: EntryKindStep,
  args: { onChoose: () => {} },
  decorators: [
    (Story) => (
      <StoryPage
        title="Choose an entry type"
        description="Bordered choices use compact 16px padding inside the logging dialog."
      >
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof EntryKindStep>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Choices: Story = {};
