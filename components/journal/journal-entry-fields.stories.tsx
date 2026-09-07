import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { JournalEntryFields } from "./journal-entry-fields";

const meta = {
  title: "Components/Journal/Entry fields",
  component: JournalEntryFields,
} satisfies Meta<typeof JournalEntryFields>;
export default meta;
type Story = StoryObj;

function Example({ repeat = false, training = false }: { repeat?: boolean; training?: boolean }) {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <StoryPage
      title="Log an entry"
      description="Friends stay with this entry, whatever your outcome."
    >
      <JournalEntryFields
        today="2026-09-06"
        kind={training ? "training" : "session"}
        climb={
          training
            ? undefined
            : { id: -1, areaId: -1, name: "Cedar Arete", type: "boulder", grade: 5 }
        }
        hasPriorSend={repeat}
        companionFetcher={async (query) =>
          [{ id: "sample-sam", name: "Sam Rivera" }].filter((friend) =>
            friend.name.toLowerCase().startsWith(query.toLowerCase()),
          )
        }
        onSave={async (form, undated) => {
          setSaved(
            `${undated ? "Undated send" : form.has("sent") ? (repeat ? "Repeat" : "Send") : training ? "Training" : "Session"} saved with ${form.getAll("companion").length} friend.`,
          );
          return { ok: true, value: undefined };
        }}
      />
      {saved && <p role="status">{saved}</p>}
    </StoryPage>
  );
}

export const Outdoor: Story = { render: () => <Example /> };
export const Repeat: Story = { render: () => <Example repeat /> };
export const Training: Story = { render: () => <Example training /> };
