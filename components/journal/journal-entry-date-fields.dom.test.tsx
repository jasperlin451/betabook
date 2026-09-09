import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { expect, it, vi } from "vitest";

import { JournalEntryDateFields } from "./journal-entry-date-fields";

function Dates(props: Partial<ComponentProps<typeof JournalEntryDateFields>> = {}) {
  const [entryDate, setEntryDate] = useState("2026-09-01");
  return (
    <JournalEntryDateFields
      kind="session"
      hasClimb
      hasPriorSend={false}
      today="2026-09-06"
      entryDate={entryDate}
      sent={false}
      onDateChange={setEntryDate}
      {...props}
    />
  );
}
it("offers I don't know only for a send, emptying and restoring the date", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Dates />);
  expect(screen.queryByRole("checkbox", { name: "I don't know" })).not.toBeInTheDocument();
  rerender(<Dates sent />);
  const unknown = screen.getByRole("checkbox", { name: "I don't know" });
  expect(unknown).not.toBeChecked();
  expect(screen.getByRole("spinbutton", { name: /day, Date/ })).toHaveTextContent("01");
  await user.click(unknown);
  expect(unknown).toBeChecked();
  expect(screen.getByRole("spinbutton", { name: /day, Date/ })).not.toHaveTextContent("01");
  await user.click(unknown);
  expect(unknown).not.toBeChecked();
  expect(screen.getByRole("spinbutton", { name: /day, Date/ })).toHaveTextContent("06");
});
it("offers I don't know for a repeat and drops its needs-a-date hint", () => {
  render(<Dates hasPriorSend sent />);
  expect(screen.getByRole("checkbox", { name: "I don't know" })).toBeInTheDocument();
  expect(
    screen.queryByText("Sessions and repeats need a date to appear in your journal."),
  ).not.toBeInTheDocument();
});
it("offers no I don't know control when editing an entry, which always needs its date", () => {
  render(<Dates existingEntry={{ sent: false, isAscent: false }} sent />);
  expect(screen.getByRole("spinbutton", { name: /day, Date/ })).toHaveTextContent("01");
  expect(screen.queryByRole("checkbox", { name: "I don't know" })).not.toBeInTheDocument();
});
it.each(["repeat", "training"])("explains that %s needs a date while not a send", (kind) => {
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
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
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
