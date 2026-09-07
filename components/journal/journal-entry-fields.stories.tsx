import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { JournalEntryFields } from "./journal-entry-fields";

const meta = {
  title: "Components/Journal/Entry fields",
  component: JournalEntryFields,
} satisfies Meta<typeof JournalEntryFields>;
export default meta;
type Story = StoryObj;

function Example({
  repeat = false,
  training = false,
  failure = false,
  slow = false,
}: {
  repeat?: boolean;
  training?: boolean;
  failure?: boolean;
  slow?: boolean;
}) {
  const [submissions, setSubmissions] = useState<
    { undated: boolean; fields: [string, FormDataEntryValue][] }[]
  >([]);
  const [completed, setCompleted] = useState(0);
  const release = useRef<(() => void) | null>(null);
  return (
    <StoryPage
      title="Log an entry"
      description="Local save boundary. Submitted entries show the real form payload, including friend identities, notes, dates and tags. No account data is written."
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
          [
            { id: "sample-sam", name: "Sam Rivera" },
            { id: "sample-alex", name: "Alex Rivera" },
          ].filter((friend) => friend.name.toLowerCase().startsWith(query.toLowerCase()))
        }
        onSave={async (form, undated) => {
          // The save boundary records requests immediately, even while React's
          // caller transition waits for our deliberately deferred response.
          flushSync(() =>
            setSubmissions((previous) => [
              ...previous,
              { undated, fields: Array.from(form.entries()) },
            ]),
          );
          if (slow)
            await new Promise<void>((resolve) => {
              release.current = resolve;
            });
          if (failure && submissions.length === 0)
            return { ok: false, error: "Couldn't save the entry. Try again." };
          return { ok: true, value: undefined };
        }}
        onDone={() => setCompleted((count) => count + 1)}
      />
      {slow && (
        <Button
          onPress={() => {
            release.current?.();
            release.current = null;
          }}
        >
          Finish sample save
        </Button>
      )}
      <p role="status">Completed saves: {completed}</p>
      <output aria-label="Submitted entries" className="text-xs break-all">
        {JSON.stringify(submissions)}
      </output>
    </StoryPage>
  );
}

export const Outdoor: Story = { render: () => <Example /> };
export const Repeat: Story = { render: () => <Example repeat /> };
export const Training: Story = { render: () => <Example training /> };
export const SaveFailure: Story = { render: () => <Example failure /> };
export const Saving: Story = { render: () => <Example slow /> };
