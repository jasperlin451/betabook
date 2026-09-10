import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { ActionResult } from "@/lib/action-result";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { FeatureAnnouncement } from "./feature-announcement";

const meta = {
  title: "Components/Feature announcement",
  component: FeatureAnnouncement,
  args: {
    userId: "story-viewer",
    featureId: "journal-tags",
    initialDismissed: false,
    title: "Your journal, organized",
    description:
      "Add tags to your sessions and training. Find the days you want to revisit with a quick filter.",
    children: <Button variant="secondary">Journal tags</Button>,
    dismissAction: async (): Promise<ActionResult> => ({ ok: true, value: undefined }),
  },
  decorators: [
    (Story) => (
      <StoryPage title="Feature announcement">
        <div className="min-h-96 pt-6">
          <Story />
        </div>
      </StoryPage>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Account-backed, persistent feature announcements. In a signed-in page loader, call isFeatureAnnouncementDismissed(db, session.user.id, featureId), then pass that boolean as initialDismissed and the viewer ID as userId. Wrap the feature control as children. Keep featureId stable when editing copy; use a new ID only for a different release. Default dismissAction saves to D1 for the authenticated account and refreshes page data. No timer, outside click, or Escape dismisses it. Only show one announcement per page. Stories replace only the save transport; reload resets these isolated demos. No existing tutorial changes are needed for this reusable announcement pattern.",
      },
    },
  },
} satisfies Meta<typeof FeatureAnnouncement>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Undismissed: Story = {};
export const PreviouslyDismissed: Story = { args: { initialDismissed: true } };
export const DismissalFails: Story = {
  args: { dismissAction: async () => ({ ok: false, error: "Couldn’t save your dismissal." }) },
};
