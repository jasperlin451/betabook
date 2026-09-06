import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { cardClass, FORM_CARD_CLASS, SURFACE_CARD_CLASS } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { SidebarLayout } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Example, StoryPage } from "@/stories/fixtures/story-layout";

const meta = { title: "Patterns/Layout and feedback", component: StoryPage } satisfies Meta<
  typeof StoryPage
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const Panels: Story = {
  render: () => (
    <StoryPage title="Panel compositions">
      <div className={FORM_CARD_CLASS}>Centered form card</div>
      <div className={SURFACE_CARD_CLASS}>Full-width form surface</div>
      <div className={PAGE_MAX_WIDTH_CLASS}>
        <SidebarLayout
          sidebar={<div className={cardClass("sm")}>Sidebar content comes first on mobile.</div>}
        >
          <div className={cardClass("fluid")}>Primary content</div>
        </SidebarLayout>
      </div>
    </StoryPage>
  ),
};
export const EmptyAndLoading: Story = {
  render: () => (
    <StoryPage title="Empty and loading states">
      <EmptyState message="No sessions match these filters." />
      <div role="status" aria-label="Loading sessions" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Example title="Loading page">
        <LoadMoreButton loading onPress={() => {}} />
      </Example>
    </StoryPage>
  ),
};
