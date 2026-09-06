import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { cardClass } from "@/components/ui/card";
import type { SharingAudience } from "@/lib/privacy";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { PrivacyFields } from "./privacy-fields";

const meta = {
  title: "Components/Account/Privacy fields",
  component: PrivacyFields,
} satisfies Meta<typeof PrivacyFields>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
function PrivacyExample({
  privateProfile = false,
  pending = false,
  error = false,
}: {
  privateProfile?: boolean;
  pending?: boolean;
  error?: boolean;
}) {
  const [isPrivate, setPrivate] = useState(privateProfile);
  const [journal, setJournal] = useState<SharingAudience>("friends");
  const [comment, setComment] = useState<SharingAudience>("public");
  return (
    <StoryPage
      title="Privacy controls"
      description="Local state only. Toggle the profile to inspect how saved audiences become unavailable."
    >
      <div className={cardClass()}>
        <PrivacyFields
          isPrivate={isPrivate}
          journalVisibility={journal}
          sendCommentVisibility={comment}
          onProfileChange={setPrivate}
          onJournalChange={setJournal}
          onSendCommentChange={setComment}
          isPending={pending}
          profileError={error ? "Could not save your changes. Try again." : null}
        />
      </div>
    </StoryPage>
  );
}
export const Privacy: Story = { render: () => <PrivacyExample /> };
export const PrivateProfile: Story = { render: () => <PrivacyExample privateProfile /> };
export const PrivacyPending: Story = { render: () => <PrivacyExample pending /> };
export const PrivacyError: Story = { render: () => <PrivacyExample error /> };
