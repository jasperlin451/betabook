import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { MobileAppHelperPanel } from "./mobile-app-helper-panel";

const meta = {
  title: "Components/Feedback/Mobile app helper",
  component: MobileAppHelperPanel,
  args: { installPrompt: null, onDismiss: () => {}, onNativeInstall: () => {} },
  decorators: [
    (Story) => (
      <StoryPage title="Home screen shortcut helper">
        <div className="relative min-h-128 transform-[translateZ(0)]">
          <Story />
        </div>
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof MobileAppHelperPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Instructions: Story = {};
