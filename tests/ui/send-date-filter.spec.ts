import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

async function openDates(page: Page, testInfo: TestInfo, story = "any") {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=components-inputs-date-filter--${story}&viewMode=story&globals=theme:${theme}`,
  );
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
