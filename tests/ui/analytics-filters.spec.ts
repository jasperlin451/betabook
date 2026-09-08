import { expect, test } from "@playwright/test";

test("selected years filter every summary and chart, and All restores the full log", async ({
  page,
}, info) => {
  await page.goto(
    `/iframe.html?id=components-charts-analytics-dashboard--all-time&viewMode=story&globals=theme:${info.project.use.colorScheme}`,
  );
  const years = page.getByRole("group", { name: "Years", exact: true });
  const tile = (label: string) => page.getByText(label, { exact: true }).locator("..");
  const value = (label: string) => tile(label).locator(":scope > span").nth(1);
  const progression = page.getByRole("region", { name: "Progression", exact: true });
  const breakthroughs = page.getByRole("region", { name: "Breakthroughs", exact: true });
  await expect(years.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await years.getByRole("button", { name: "2024", exact: true }).click();
  await expect(value("Sends")).toHaveText("1");
  await expect(value("Best year")).toHaveText("2024");
  await expect(tile("Hardest")).toContainText("First high point");
  await expect(progression).toContainText("Personal best V5");
  await expect(breakthroughs.getByRole("link")).toHaveText(["First high point"]);
  await expect(page.locator('section[aria-label^="Calendar "]')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Calendar 2024", exact: true })).toBeVisible();

  await years.getByRole("button", { name: "2025", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity in 2024–2025" })).toBeVisible();
  await expect(years.getByRole("button", { name: "2024", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(years.getByRole("button", { name: "2025", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(value("Sends")).toHaveText("3");
  await expect(value("Best year")).toHaveText("2025");
  await expect(page.getByText(/Send pyramid:/)).toContainText("V5: 1 send, V3: 1 send, V2: 1 send");
  await expect(page.locator('section[aria-label^="Calendar "]')).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Calendar 2024", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Newer calendar year", exact: true }).click();
  await expect(page.getByRole("region", { name: "Calendar 2025", exact: true })).toBeVisible();
  await expect(progression).not.toContainText("Apr 2026");
  await info.attach("multiple-years", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await years.getByRole("button", { name: "2025", exact: true }).press("Space");
  await years.getByRole("button", { name: "2026", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity in 2024, 2026" })).toBeVisible();
  await expect(value("Sends")).toHaveText("2");
  await expect(progression).toContainText("Personal best V6");
  await expect(breakthroughs.getByRole("link")).toHaveText(["New high point", "First high point"]);
  await expect(page.getByRole("region", { name: "Calendar 2025", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Calendar 2024", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Newer calendar year", exact: true }).click();
  await expect(page.getByRole("region", { name: "Calendar 2026", exact: true })).toBeVisible();

  await years.getByRole("button", { name: "All", exact: true }).press("Space");
  await expect(value("Sends")).toHaveText("5");
  await expect(tile("Hardest")).toContainText("An undated ascent");
  await expect(page.locator('section[aria-label^="Calendar "]')).toHaveCount(3);
  await years.getByRole("button", { name: "2023", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "No activity" })).toHaveText(
    "No activity in 2023 for this discipline. Try another year or All.",
  );
  await expect(value("Best year")).toHaveText("—");
  await expect(breakthroughs.getByRole("link")).toHaveCount(0);
  await expect(progression).toContainText("No dated sends with grades yet");
  await years.getByRole("button", { name: "2023", exact: true }).click();
  await expect(years.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(tile("Hardest")).toContainText("An undated ascent");
});
