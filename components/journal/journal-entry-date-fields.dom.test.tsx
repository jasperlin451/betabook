import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { expect, it, vi } from "vitest";

import { JournalEntryDateFields } from "./journal-entry-date-fields";

function Dates(props: Partial<ComponentProps<typeof JournalEntryDateFields>> = {}) {
  const [sent, setSent] = useState(false);
  const [unknown, setUnknown] = useState(false);
  return (
    <JournalEntryDateFields
      kind="session"
      hasClimb
      hasPriorSend={false}
      today="2026-09-06"
      entryDate="2026-09-01"
      sent={sent}
      dateUnknown={unknown}
      onDateChange={() => {}}
      onSentChange={setSent}
      onDateUnknownChange={setUnknown}
      {...props}
    />
  );
}
it("selects a send for an unknown date and restores the date when unchecked", async () => {
  const user = userEvent.setup();
  render(<Dates />);
  const sent = screen.getByRole("checkbox", { name: "I sent" });
  const unknown = screen.getByRole("checkbox", { name: "Record without a date" });
  expect(unknown).toBeEnabled();
  expect(unknown).toHaveAccessibleDescription(
    "Records a send when you don’t know the date. Selecting this also selects ‘I sent’.",
  );
  await user.click(unknown);
  expect(sent).toBeChecked();
  expect(unknown).toBeChecked();
  expect(screen.queryByRole("spinbutton", { name: /day, Date/ })).not.toBeInTheDocument();
  await user.click(unknown);
  expect(unknown).not.toBeChecked();
  expect(sent).toBeChecked();
  expect(screen.getByRole("spinbutton", { name: /day, Date/ })).toHaveTextContent("01");
  await user.click(sent);
  expect(unknown).not.toBeChecked();
});
it.each(["repeat", "training"])(
  "explains that %s needs a date and omits unknown dates",
  async (kind) => {
    const user = userEvent.setup();
    render(
      <Dates
        kind={kind === "training" ? "training" : "session"}
        hasClimb={kind !== "training"}
        hasPriorSend={kind === "repeat"}
      />,
    );
    const guidance =
      kind === "training"
        ? "Training entries need a date to appear in your journal."
        : "Sessions and repeats need a date to appear in your journal.";
    expect(screen.getByText(guidance)).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Record without a date" }),
    ).not.toBeInTheDocument();
    if (kind === "repeat") {
      await user.click(screen.getByRole("checkbox", { name: "I sent" }));
      expect(screen.getByText(guidance)).toBeInTheDocument();
    } else expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  },
);
it.each([true, false])(
  "prevents editing a recorded date and gives ascent=%s guidance",
  async (isAscent) => {
    const user = userEvent.setup();
    const change = vi.fn<(date: string) => void>();
    render(<Dates existingEntry={{ sent: true, isAscent }} sent onDateChange={change} />);
    expect(
      screen.getByText(
        isAscent
          ? "To change the ascent date, use Edit send on the climb page."
          : "To change this repeat’s date, delete the entry and log it again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calendar Date" })).toBeDisabled();
    const day = screen.getByRole("spinbutton", { name: /day, Date/ });
    await user.click(day);
    await user.keyboard("{ArrowUp}");
    expect(day).toHaveTextContent("01");
    expect(change).not.toHaveBeenCalled();
  },
);
