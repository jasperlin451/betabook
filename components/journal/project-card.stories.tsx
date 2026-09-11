import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ashCrack, moonSlab, riverRoute } from "@/stories/fixtures/open-projects";
import { Example, StoryPage } from "@/stories/fixtures/story-layout";

import { ProjectCard, type ProjectWithSessions } from "./project-card";

const meta = {
  title: "Components/Journal/Project card",
  component: ProjectCard,
} satisfies Meta<typeof ProjectCard>;
export default meta;
// Expansion belongs to the board in production; these examples hold it locally.
type Story = StoryObj;

const TODAY = "2026-09-06";

function Card({
  project,
  initiallyExpanded = false,
}: {
  project: ProjectWithSessions;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <ProjectCard
      project={project}
      userId="storybook-climber"
      today={TODAY}
      isExpanded={expanded}
      onExpandedChange={setExpanded}
      onLogSession={() => setExpanded(true)}
    />
  );
}

export const Project: Story = {
  render: () => (
    <StoryPage
      title="Project card"
      description="What the climber wrote last is on the card; the rest of the history is one press away."
    >
      <Example title="Worked recently">
        <Card project={moonSlab} />
      </Example>
      <Example title="Gone cold">
        <Card project={riverRoute} />
      </Example>
      <Example title="Dates only, no notes written">
        <Card project={ashCrack} />
      </Example>
    </StoryPage>
  ),
};

export const SessionsOpen: Story = {
  render: () => (
    <StoryPage
      title="Project card"
      description="Opened, the card drops the single-note preview and shows the session history in full."
    >
      <Card project={moonSlab} initiallyExpanded />
    </StoryPage>
  ),
};
