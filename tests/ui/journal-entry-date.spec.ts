import { expect, test, openStory } from "./story";

test("unknown dates are discoverable before marking a send and reset when returning to a session", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-date--session");
  const sent = page.getByRole("checkbox", { name: "I sent", exact: true });
  const unknown = page.getByRole("checkbox", { name: "I don't remember the date", exact: true });
  await expect(unknown).toBeVisible();
  await expect(unknown).toBeDisabled();
  await expect(unknown).toHaveAccessibleDescription(
    "Sessions need a date. Select “I sent” to record a send without one.",
  );
  const date = page.getByRole("group", { name: "Date", exact: true });
  const sentBox = await sent.boundingBox();
  const dateBox = await date.boundingBox();
  if (!sentBox || !dateBox) throw new Error("Expected visible send and date controls");
  expect(sentBox.y + sentBox.height).toBeLessThan(dateBox.y);

  await sent.focus();
  await page.keyboard.press("Space");
  await expect(unknown).toBeEnabled();
  await expect(unknown).toHaveAccessibleDescription(
    "Saved in Sends. Add a date later to include it in your journal.",
  );
  await unknown.focus();
  await page.keyboard.press("Space");
  await expect(unknown).toBeChecked();
  await expect(date).toBeHidden();
  await info.attach("undated-send", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });

  await page.getByText("I sent", { exact: true }).click();
  await expect(unknown).not.toBeChecked();
  await expect(unknown).toBeDisabled();
  await expect(date).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /day,/ })).toHaveText("01");
  await page.getByText("I sent", { exact: true }).click();
  await expect(unknown).not.toBeChecked();
  await expect(date).toBeVisible();
});

test("repeat and training date requirements are explained beside the date", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-date--repeat");
  await expect(
    page.getByText("Sessions and repeats need a date to appear in your journal."),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "I don't remember the date" })).toHaveCount(0);
  await page.getByText("I sent", { exact: true }).click();
  await expect(
    page.getByText("Sessions and repeats need a date to appear in your journal."),
  ).toBeVisible();
  await openStory(page, info, "components-journal-entry-date--training");
  await expect(
    page.getByText("Training entries need a date to appear in your journal."),
  ).toBeVisible();
});

for (const [story, guidance] of [
  ["edit-ascent", "To change the ascent date, use Edit send on the climb page."],
  ["edit-repeat", "To change this repeat’s date, delete the entry and log it again."],
]) {
  test(`${story} prevents changing the recorded date and explains where to edit it`, async ({
    page,
  }, info) => {
    await openStory(page, info, `components-journal-entry-date--${story}`);
    await expect(page.getByText(guidance, { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Calendar Date", exact: true })).toBeDisabled();
    const day = page.getByRole("spinbutton", { name: "day, Date", exact: true });
    await day.press("ArrowUp");
    await expect(day).toHaveText("01");
  });
}
