import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { openProjects } from "@/stories/fixtures/open-projects";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { ProjectBoard } from "./project-board";

const meta = {
  title: "Components/Journal/Project board",
  component: ProjectBoard,
} satisfies Meta<typeof ProjectBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Projects: Story = {
  args: { userId: "storybook-climber", projects: openProjects, hasMore: false },
  render: (args) => (
    <StoryPage
      title="Projects"
      description="Every open project arrives with its latest note already on the card. Search covers climbs, areas, tags and the notes themselves; opening a card shows the session history in place."
    >
      <ProjectBoard {...args} />
    </StoryPage>
  ),
};

export const MoreThanOnePage: Story = {
  args: { userId: "storybook-climber", projects: openProjects, hasMore: true },
  render: (args) => (
    <StoryPage
      title="Projects"
      description="With more open projects than one page holds, the count reads as a floor and the list says what it is showing."
    >
      <ProjectBoard {...args} />
    </StoryPage>
  ),
};

export const NoProjects: Story = {
  args: { userId: "storybook-climber", projects: [], hasMore: false },
  render: (args) => (
    <StoryPage
      title="Projects"
      description="Nothing is open yet: a session on a climb the climber hasn't sent is what starts one."
    >
      <ProjectBoard {...args} />
    </StoryPage>
  ),
};
