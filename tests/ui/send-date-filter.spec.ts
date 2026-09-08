import type { Page, TestInfo } from "@playwright/test";

import { expect, test, openStory } from "./story";

async function openDates(page: Page, testInfo: TestInfo, story = "any") {
  await openStory(page, testInfo, `components-filters-date-filter--${story}`);
}

async function choose(page: Page, option: string) {
  await page.getByRole("button", { name: /Dates$/ }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Dates defaults to All time and applies calendar presets", async ({ page }, testInfo) => {
  await openDates(page, testInfo);
  const dates = page.getByRole("status", { name: "Selected dates" });
  await expect(page.getByRole("button", { name: "All time Dates" })).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  for (const [label, preset, start, end] of [
    ["This month", "this-month", "2026-09-01", "2026-09-30"],
    ["This year", "this-year", "2026-01-01", "2026-12-31"],
    ["Last year", "last-year", "2025-01-01", "2025-12-31"],
  ]) {
    await choose(page, label);
    await expect(dates).toHaveText(
      JSON.stringify({ dateFrom: start, dateTo: end, datePreset: preset }),
    );
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  }
  await choose(page, "All time");
  await expect(dates).toHaveText("{}");
});

test("custom dates accept typing, validate order, and support a single day", async ({
  page,
}, testInfo) => {
  await openDates(page, testInfo);
  await choose(page, "Custom dates");
  const dates = page.getByRole("status", { name: "Selected dates" });
  const segments = page.getByRole("spinbutton");
  await segments.nth(0).fill("6");
  await segments.nth(1).fill("1");
  await expect(dates).toHaveText("{}");
  await segments.nth(2).fill("2025");
  await segments.nth(3).fill("8");
  await segments.nth(4).fill("31");
  await segments.nth(5).fill("2025");

  await expect(dates).toHaveText('{"dateFrom":"2025-06-01","dateTo":"2025-08-31"}');
  await segments.nth(5).fill("2024");
  await expect(page.getByRole("alert")).toHaveText("End date must be on or after start date.");
  await expect(dates).toHaveText('{"dateFrom":"2025-06-01","dateTo":"2025-08-31"}');
  await segments.nth(3).fill("6");
  await segments.nth(4).fill("1");
  await segments.nth(5).fill("2025");
  await expect(dates).toHaveText('{"date":"2025-06-01"}');
  await choose(page, "All time");
  await expect(dates).toHaveText("{}");
  await expect(segments).toHaveCount(0);
});

test("custom date calendars select both endpoints", async ({ page }, testInfo) => {
  await openDates(page, testInfo, "date-range");
  await page.getByRole("button", { name: "Calendar Start date" }).click();
  await page.getByRole("button", { name: "Monday, June 2, 2025", exact: true }).click();
  await page.getByRole("button", { name: "Calendar End date (optional)" }).click();
  await page.getByRole("button", { name: "Saturday, August 30, 2025", exact: true }).click();
  await expect(page.getByRole("status", { name: "Selected dates" })).toHaveText(
    '{"dateFrom":"2025-06-02","dateTo":"2025-08-30"}',
  );
});

test("a start date alone searches one day and the optional end can be removed", async ({
  page,
}, testInfo) => {
  await openDates(page, testInfo);
  await choose(page, "Custom dates");
  const dates = page.getByRole("status", { name: "Selected dates" });
  const segments = page.getByRole("spinbutton");
  await expect(page.getByText("Choose a day, or the first day of a range.")).toBeVisible();
  await expect(
    page.getByText("Leave blank for one day. A range includes both dates."),
  ).toBeVisible();
  await segments.nth(0).fill("6");
  await segments.nth(1).fill("1");
  await segments.nth(2).fill("2025");
  await expect(dates).toHaveText('{"date":"2025-06-01"}');
  await expect(segments.nth(3)).toHaveText("mm");
  await segments.nth(3).fill("8");
  await segments.nth(4).fill("31");
  await segments.nth(5).fill("2025");
  await expect(dates).toHaveText('{"dateFrom":"2025-06-01","dateTo":"2025-08-31"}');
  await page.getByRole("button", { name: "Clear end date" }).click();
  await expect(dates).toHaveText('{"date":"2025-06-01"}');
});

for (const view of ["journal", "sends"]) {
  for (const [story, label] of [
    ["single-day", "Jun 1, 2025"],
    ["date-range", "Jun 1, 2025 – Aug 31, 2025"],
  ]) {
    test(`${view} keeps ${story} visible outside More filters`, async ({ page }, testInfo) => {
      const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
      await page.goto(
        `/iframe.html?id=components-filters-${view}-toolbar--${story}&viewMode=story&globals=theme:${theme}`,
      );
      const chip = page.getByRole("link", { name: "Clear date filter" });
      await expect(chip).toHaveText(label);
      const chipBounds = await chip.boundingBox();
      const headingBounds = await page.getByRole("heading", { level: 1 }).boundingBox();
      const moreBounds = await page
        .getByRole("button", { name: "More filters", exact: true })
        .boundingBox();
      const lastTagBounds = await page
        .getByRole(view === "journal" ? "link" : "button", {
          name: view === "journal" ? "Training" : "Trad",
          exact: true,
        })
        .boundingBox();
      if (!lastTagBounds || !moreBounds) throw new Error("Filter controls must be rendered.");
      expect(moreBounds.y + moreBounds.height / 2).toBeCloseTo(
        lastTagBounds.y + lastTagBounds.height / 2,
        0,
      );
      expect(moreBounds.x).toBeGreaterThanOrEqual(lastTagBounds.x + lastTagBounds.width);
      expect(moreBounds.x - lastTagBounds.x - lastTagBounds.width).toBeLessThanOrEqual(12);
      if (!chipBounds || !headingBounds || !moreBounds) {
        throw new Error("The date chip, heading, and filter trigger must be rendered.");
      }
      expect(chipBounds.x).toBeCloseTo(headingBounds.x, 0);
      expect(chipBounds.y).toBeGreaterThan(moreBounds.y + moreBounds.height);
      await expect(chip).toHaveAttribute(
        "href",
        view === "sends" ? "/sample/sends?sort=date_desc" : "/users/example/journal",
      );
      await expect(page.getByRole("button", { name: /Dates$/ })).not.toBeVisible();
      await page.getByRole("button", { name: "More filters", exact: true }).click();
      await expect(page.getByRole("button", { name: "Custom dates Dates" })).toBeVisible();
      await expect(page.getByRole("spinbutton")).toHaveCount(6);
      await page.getByRole("button", { name: "Fewer filters", exact: true }).click();
      await expect(chip).toBeVisible();
      await expect(page.getByRole("spinbutton").first()).not.toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${view}-${story}.png`) });
      await chip.locator("svg").click();
      await expect(chip).toHaveCount(0);
      await page.getByRole("button", { name: "More filters", exact: true }).click();
      await expect(page.getByRole("button", { name: "All time Dates" })).toBeVisible();
      await expect(page.getByRole("spinbutton")).toHaveCount(0);
    });
  }
}
