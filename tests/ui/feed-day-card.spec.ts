import { expect, test } from "@playwright/test";

for (const scenario of [
  {
    story: "more-activity",
    section: "journal",
    remaining: 2,
    revealed: ["Birch Wall", "Finished with shoulder mobility and stretching."],
  },
  {
    story: "remaining-activity",
    section: "journal",
    remaining: 1,
    revealed: ["Easy movement practice and a short hangboard session."],
  },
]) {
  test(`${scenario.story} opens the complete sample day and returns to the preview`, async ({
    page,
  }, testInfo) => {
    const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
    await page.goto(
      `/iframe.html?id=components-journal-feed-day-card--${scenario.story}&viewMode=story&globals=theme:${theme}`,
    );
    const more = page.getByRole("link", {
      name: `See all activity (${scenario.remaining} more)`,
      exact: true,
    });
    await expect(more).toHaveAttribute(
      "href",
      `/users/storybook-climber/${scenario.section}?date=2026-09-01`,
    );
    for (const text of scenario.revealed)
      await expect(page.getByText(text, { exact: true })).toHaveCount(0);
    const url = page.url();
    const requests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr", "document"].includes(request.resourceType()))
        requests.push(request.url());
    });
    await more.click();
    const destination = page.getByRole("heading", {
      name: `Alex Rivera’s ${scenario.section}`,
      exact: true,
    });
    await expect(destination).toBeVisible();
    for (const text of scenario.revealed)
      await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(more).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("complete-day.png"), fullPage: true });
    await page.getByRole("button", { name: "Back to feed", exact: true }).click();
    await expect(more).toBeVisible();
    for (const text of scenario.revealed)
      await expect(page.getByText(text, { exact: true })).toHaveCount(0);
    await more.focus();
    await more.press("Enter");
    await expect(destination).toBeVisible();
    await page.getByRole("button", { name: "Back to feed", exact: true }).click();
    await page.getByRole("link", { name: "View activity for Alex Rivera on Sep 1, 2026" }).click();
    await expect(destination).toBeVisible();
    expect(page.url()).toBe(url);
    expect(requests).toEqual([]);
  });
}
