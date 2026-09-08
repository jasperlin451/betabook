import { expect, test, openStory } from "./story";

test("send controls precede the date and keyboard selection reveals the undated layout", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-date--session");
  const sent = page.getByRole("checkbox", { name: "I sent", exact: true });
  const unknown = page.getByRole("checkbox", { name: "Record without a date", exact: true });
  await expect(unknown).toBeVisible();
  const date = page.getByRole("group", { name: "Date", exact: true });
  const sentBox = await sent.boundingBox();
  const dateBox = await date.boundingBox();
  if (!sentBox || !dateBox) throw new Error("Expected visible send and date controls");
  expect(sentBox.y + sentBox.height).toBeLessThan(dateBox.y);

  await unknown.focus();
  await page.keyboard.press("Space");
  await expect(unknown).toBeChecked();
  await expect(date).toBeHidden();
  await info.attach("undated-send", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});
