import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

async function openStory(page: Page, info: TestInfo, story: string) {
  const theme = info.project.use.colorScheme;
  await page.goto(
    `/iframe.html?id=components-journal-entry-date--${story}&viewMode=story&globals=theme:${theme}`,
  );
  await expect(page.getByRole("heading", { name: "Entry date", exact: true })).toBeVisible();
}

test("unknown dates are discoverable before marking a send and reset when returning to a session", async ({
  page,
}, info) => {
  await openStory(page, info, "session");
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
    body: await page.screenshot({ fullPage: true }),
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
  await openStory(page, info, "repeat");
  await expect(
    page.getByText("Sessions and repeats need a date to appear in your journal."),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "I don't remember the date" })).toHaveCount(0);
  await page.getByText("I sent", { exact: true }).click();
  await expect(
    page.getByText("Sessions and repeats need a date to appear in your journal."),
  ).toBeVisible();
  await openStory(page, info, "training");
  await expect(
    page.getByText("Training entries need a date to appear in your journal."),
  ).toBeVisible();
});
