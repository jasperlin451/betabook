import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { GENERIC_ERROR_MESSAGE, type ActionResult } from "@/lib/action-result";

import { JournalEntryFields, type JournalEntryFieldsProps } from "./journal-entry-fields";

const climb = { id: 17, areaId: 3, name: "Cedar Arete", type: "boulder" as const, grade: 5 };
const success: ActionResult = { ok: true, value: undefined };
function setup(props: Partial<JournalEntryFieldsProps> = {}) {
  const onSave = vi.fn<JournalEntryFieldsProps["onSave"]>().mockResolvedValue(success);
  const onDone = vi.fn<() => void>();
  const onPendingChange = vi.fn<(pending: boolean) => void>();
  const user = userEvent.setup();
  render(
    <JournalEntryFields
      today="2026-09-06"
      kind="session"
      climb={climb}
      companionFetcher={async () => [{ id: "sam", name: "Sam Rivera" }]}
      onSave={onSave}
      onDone={onDone}
      onPendingChange={onPendingChange}
      {...props}
    />,
  );
  return { user, onSave, onDone, onPendingChange };
}
async function addFriend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox", { name: "Find a friend to tag" }), "Sam");
  await user.click(await screen.findByRole("option", { name: "Sam Rivera" }));
  expect(screen.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeInTheDocument();
}
async function fillNotes(user: ReturnType<typeof userEvent.setup>, training = false) {
  await user.type(
    screen.getByRole("textbox", { name: training ? "What did you do?" : "How'd it go?" }),
    "Kept the high foot.",
  );
  await user.type(screen.getByRole("textbox", { name: /Add a tag/ }), "technique{Enter}");
}

it.each(["outdoor", "repeat", "training"])(
  "submits %s friend identity, note, date and tags",
  async (kind) => {
    const { user, onSave, onDone } = setup({
      kind: kind === "training" ? "training" : "session",
      climb: kind === "training" ? null : climb,
      hasPriorSend: kind === "repeat",
    });
    await addFriend(user);
    await fillNotes(user, kind === "training");
    if (kind !== "training") await user.click(screen.getByRole("checkbox", { name: "I sent" }));
    else expect(screen.queryByRole("checkbox", { name: "I sent" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledOnce();
    const [form, undated] = onSave.mock.calls[0];
    expect(undated).toBe(false);
    expect(Array.from(form.entries())).toEqual([
      ["kind", kind === "training" ? "training" : "session"],
      ["entryDate", "2026-09-06"],
      ["body", "Kept the high foot."],
      ...(kind === "training"
        ? []
        : [
            ["climbId", "17"],
            ["sent", "true"],
          ]),
      ["tag", "technique"],
      ["companionsChanged", "true"],
      ["companion", "sam"],
      ...(kind === "outdoor"
        ? [
            ["ascentStyle", "redpoint"],
            ["rating", ""],
            ["suggestedGrade", "5"],
            ["gradeFeel", "solid"],
          ]
        : []),
    ]);
  },
);

it("blocks an undated send with friends and preserves their identities on recovery", async () => {
  const { user, onSave } = setup();
  await addFriend(user);
  await user.click(screen.getByRole("checkbox", { name: "I sent" }));
  const unknown = screen.getByRole("checkbox", { name: "I don't remember the date" });
  await user.click(unknown);
  await user.click(screen.getByRole("button", { name: "Save send" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Add a date to keep With friends.");
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeInTheDocument();
  await user.click(unknown);
  await user.click(screen.getByRole("button", { name: "Save entry" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSave.mock.calls[0][1]).toBe(false);
  expect(onSave.mock.calls[0][0].getAll("companion")).toEqual(["sam"]);
});

it("preserves undated commentary and omits journal-only tags", async () => {
  const { user, onSave } = setup();
  await fillNotes(user);
  await user.click(screen.getByRole("checkbox", { name: "I sent" }));
  await user.click(screen.getByRole("checkbox", { name: "I don't remember the date" }));
  expect(screen.queryByRole("textbox", { name: /Add a tag/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save send" }));
  expect(onSave).toHaveBeenCalledOnce();
  const [form, undated] = onSave.mock.calls[0];
  expect(undated).toBe(true);
  expect(form.get("dateSent")).toBe("");
  expect(form.get("comment")).toBe("Kept the high foot.");
  expect(form.get("climbId")).toBe("17");
  expect(form.getAll("tag")).toEqual([]);
  expect(form.getAll("companion")).toEqual([]);
});

it.each(["rejection", "exception"])(
  "retains entered data after a save %s and retries the same payload",
  async (failure) => {
    const { user, onSave, onDone, onPendingChange } = setup();
    if (failure === "exception") onSave.mockRejectedValueOnce(new Error("Private service details"));
    else onSave.mockResolvedValueOnce({ ok: false, error: "Couldn't save the entry. Try again." });
    await addFriend(user);
    await fillNotes(user);
    const save = screen.getByRole("button", { name: "Save entry" });
    await user.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      failure === "exception" ? GENERIC_ERROR_MESSAGE : "Couldn't save the entry. Try again.",
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "How'd it go?" })).toHaveValue(
      "Kept the high foot.",
    );
    expect(screen.getByRole("button", { name: "Remove tag technique" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeInTheDocument();
    await user.click(save);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(Array.from(onSave.mock.calls[1][0].entries())).toEqual(
      Array.from(onSave.mock.calls[0][0].entries()),
    );
    expect(onPendingChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  },
);

it("prevents another submission and friend changes until the pending save completes", async () => {
  const { user, onSave, onDone, onPendingChange } = setup();
  let finish!: (result: ActionResult) => void;
  onSave.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await addFriend(user);
  const save = screen.getByRole("button", { name: "Save entry" });
  await user.click(save);
  expect(save).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeDisabled();
  await user.click(save);
  // A submit event can also arrive without a button click (for example,
  // requestSubmit). Exercise the form's pending guard as well as its button.
  fireEvent.submit(save.closest("form")!);
  expect(onSave).toHaveBeenCalledOnce();
  expect(onDone).not.toHaveBeenCalled();
  expect(onPendingChange.mock.calls).toEqual([[true]]);
  await act(async () => finish(success));
  expect(save).toBeEnabled();
  expect(onDone).toHaveBeenCalledOnce();
  expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
});
