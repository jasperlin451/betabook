import { expect, test, openStory } from "./story";

test("date precedes send controls and keyboard selection reveals the undated layout", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  const sent = page.getByRole("checkbox", { name: "I sent", exact: true });
  const date = page.getByRole("group", { name: "Date", exact: true });
  const sentBox = await sent.boundingBox();
  const dateBox = await date.boundingBox();
  if (!sentBox || !dateBox) throw new Error("Expected visible send and date controls");
  expect(dateBox.y + dateBox.height).toBeLessThan(sentBox.y);

  await page.getByRole("button", { name: "Add details" }).click();
  const unknown = page.getByRole("checkbox", { name: "Record a send without a date", exact: true });
  await unknown.focus();
  await page.keyboard.press("Space");
  await expect(unknown).toBeChecked();
  await expect(sent).toBeChecked();
  await expect(date).toBeHidden();
  await info.attach("undated-send", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});
