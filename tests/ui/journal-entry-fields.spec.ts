import { expect, test } from "@playwright/test";

test("send commentary explains its audience in a tooltip without submitting the form", async ({
  page,
}, testInfo) => {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=components-journal-entry-fields--outdoor&viewMode=story&globals=theme:${theme}`,
  );
  const help = page.getByRole("button", { name: "About Send commentary", exact: true });
  await expect(help).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
  await expect(help).toBeVisible();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeHidden();
  await help.click();
  await expect(tooltip).toHaveText(
    "Uses your Send commentary audience wherever this note appears.",
  );
  await expect(tooltip).toHaveCSS("opacity", "1");
  await expect(page.getByRole("status").filter({ hasText: "saved with" })).toHaveCount(0);
  await expect(page.getByText(/Other journal notes have a separate audience/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("commentary-help.png"), fullPage: true });
  await page.getByRole("textbox", { name: "How'd it go?" }).focus();
  await expect(tooltip).toBeHidden();
});

for (const story of ["outdoor", "repeat"]) {
  test(`${story} keeps selected friends when I sent is checked`, async ({ page }, testInfo) => {
    const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
    await page.goto(
      `/iframe.html?id=components-journal-entry-fields--${story}&viewMode=story&globals=theme:${theme}`,
    );
    const input = page.getByRole("combobox", { name: "Find a friend to tag" });
    await input.fill("Sam");
    await page.getByRole("option", { name: "Sam Rivera" }).click();
    await input.press("Tab");
    await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
    await expect(page.getByRole("checkbox", { name: "I sent", exact: true })).toBeChecked();
    await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeVisible();
    const friends = await page.getByRole("group", { name: "With friends" }).boundingBox();
    const notes = await page.getByRole("textbox", { name: "How'd it go?" }).boundingBox();
    if (!friends || !notes) throw new Error("Missing friend picker or note field");
    expect(friends.y + friends.height).toBeLessThan(notes.y);
    if (story === "outdoor") {
      const ascent = await page.getByText("The ascent", { exact: true }).boundingBox();
      if (!ascent) throw new Error("Missing ascent fields");
      expect(friends.y + friends.height).toBeLessThan(ascent.y);
    }
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "saved with" })).toHaveText(
      `${story === "repeat" ? "Repeat" : "Send"} saved with 1 friend.`,
    );
    await page.screenshot({ path: testInfo.outputPath("send-with-friends.png"), fullPage: true });
  });
}

test("an unknown date never silently discards selected friends", async ({ page }) => {
  await page.goto("/iframe.html?id=components-journal-entry-fields--outdoor&viewMode=story");
  const input = page.getByRole("combobox", { name: "Find a friend to tag" });
  await input.fill("Sam");
  await page.getByRole("option", { name: "Sam Rivera" }).click();
  await input.press("Tab");
  await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
  await page.getByRole("checkbox", { name: "I don't remember the date" }).press("Space");
  await page.getByRole("button", { name: "Save send", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Add a date to keep With friends.");
  await expect(page.getByRole("status").filter({ hasText: "saved with" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeVisible();
  await page.getByRole("checkbox", { name: "I don't remember the date" }).press("Space");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved with" })).toHaveText(
    "Send saved with 1 friend.",
  );
});
