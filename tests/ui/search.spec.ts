import { AxeBuilder } from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

import { expect, test, openStory } from "./story";

async function openSearchStory(page: Page, testInfo: TestInfo, name: string) {
  await openStory(page, testInfo, `patterns-search--${name}`);
}

test("quick search offers area context only for climbs", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  const scope = page.getByRole("button", { name: "Climbs in Cedar Grove", exact: true });
  await expect(scope).toBeVisible();
  await page.getByRole("button", { name: "Climbers", exact: true }).click();
  await expect(scope).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Cedar Lee, Climbing partner" })).toBeVisible();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await expect(scope).toHaveCount(0);
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await expect(scope).toBeVisible();
});

test("clearing quick area scope removes the chip and restores global results", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  await page.getByRole("button", { name: "Climbs in Cedar Grove", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toHaveAttribute("aria-disabled", "false");
  await expect(
    page.getByRole("option", { name: "Cedar Arete, Coast Range / Cedar Grove", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear area Cedar Grove" }).click();
  await expect(
    page.getByRole("button", { name: /Climbs in Cedar Grove|Clear area Cedar Grove/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Search Betabook" })).toHaveValue("cedar");
  await expect(
    page.getByRole("option", { name: "Cedar Arete, Coast Range / Cedar Grove", exact: true }),
  ).toHaveAttribute("aria-disabled", "false");
});

test("full search has one search field without the extra area lookup", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "full-results");
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "In area", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Cedar Arete, North Woods/ })).toBeEnabled();
});

test("logging picker omits the area lookup", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "climb-picker");
  await expect(page.getByRole("searchbox", { name: "Choose a climb" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "In area", exact: true })).toHaveCount(0);
});

test("logging picker paginates and selects a record from the next page", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "climb-picker");
  const results = page.getByRole("region", { name: "Climbs results" });
  const first = results.getByRole("button", {
    name: "Choose Cedar Arete, North Woods / Cedar Grove",
    exact: true,
  });
  const next = results.getByRole("button", {
    name: "Choose Cedar Traverse, North Woods / Lower boulders",
    exact: true,
  });
  await expect(first).toBeEnabled();
  await expect(results.getByRole("button")).toHaveCount(5);
  await expect(next).toHaveCount(0);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(next).toBeEnabled();
  await expect(results.getByRole("button")).toHaveCount(7);
  await expect(first).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Load more", exact: true })).toHaveCount(0);
  await next.click();
  await expect(page.getByLabel("Selected record")).toHaveAttribute("data-selected-id", "climb-105");
});

test("blank quick search waits for a query in every category", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  await expect(page.getByRole("option", { name: /Cedar Lee/ })).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "Clear search betabook" }).click();
  for (const category of ["Climbs", "Areas", "Climbers"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await page.clock.runFor(700);
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(
      page.getByText(`Search ${category.toLowerCase()} by name.`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search Betabook" })).toHaveAttribute(
      "placeholder",
      `Search ${category.toLowerCase()}…`,
    );
    await expect(page.getByRole("button", { name: "Browse climbs" })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await page.getByRole("button", { name: "Climbs in Cedar Grove", exact: true }).click();
  await page.clock.runFor(700);
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear area Cedar Grove" })).toBeVisible();
});

test("full search clears results and waits for typing on the Climbs tab", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "full-results");
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open Cedar Arete, North Woods/ })).toBeEnabled();
  await page.clock.install();
  await page.getByRole("button", { name: "Clear search betabook" }).click();
  await page.clock.runFor(700);
  await expect(page.getByRole("region", { name: "Climbs results" })).toHaveCount(0);
  await expect(page.getByText("Search climbs by name.", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Betabook" }).fill("cedar crack");
  await page.clock.runFor(700);
  await expect(
    page.getByRole("button", { name: "Open Cedar Crack, North Woods / Upper Wall" }),
  ).toBeEnabled();
});

test("empty logging picker shows one prompt without result headings or repeated instructions", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "climb-picker");
  await expect(page.getByRole("button", { name: /Choose Cedar Arete, North Woods/ })).toBeEnabled();
  await page.getByRole("button", { name: "Clear choose a climb" }).click();
  await expect(page.getByRole("heading", { name: "Climbs", exact: true })).toHaveCount(0);
  await expect(page.getByText("Choose a climb to continue.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Search for a climb by name.", { exact: true })).toHaveCount(1);
  await testInfo.attach("empty-log-picker", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});

test("search journey preserves query, category and explicit area scope", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "search-journey");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search Betabook" });
  await expect(dialog.getByRole("combobox", { name: "Search Betabook" })).toBeFocused();
  await dialog.getByRole("button", { name: "Climbs in Cedar Grove", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Climbs", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "Clear area Cedar Grove" })).toBeVisible();
  await expect(
    dialog.getByRole("option", { name: "Cedar Crack, North Woods / Upper Wall" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "View all results for “cedar”" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toHaveValue("cedar");
  await expect(page.getByRole("button", { name: "Climbs", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Clear area Cedar Grove" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Cedar Crack/ })).toHaveCount(0);
});

test("quick search selects by keyboard and returns focus on Escape", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  const trigger = page.getByRole("button", { name: "Search Betabook", exact: true });
  await trigger.click();
  await expect(page.getByRole("option", { name: "Cedar Lee, Climbing partner" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await testInfo.attach("quick-search", {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  const input = page.getByRole("combobox", { name: "Search Betabook" });
  await input.fill("cedar crack");
  await expect(
    page.getByRole("option", { name: "Cedar Crack, North Woods / Upper Wall" }),
  ).toHaveAttribute("aria-disabled", "false");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByLabel("Selected record")).toHaveAttribute("data-selected-id", "climb-102");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("pending quick results cannot select an old record", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Search Betabook" });
  await input.fill("cedar crack");
  await expect(
    page.getByRole("option", { name: "Cedar Crack, North Woods / Upper Wall" }),
  ).toHaveAttribute("aria-disabled", "false");
  await input.press("ArrowDown");
  await input.fill("north face");
  await input.press("Enter");
  await expect(page.getByLabel("Selected record")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toHaveValue("north face");
  await expect(
    page.getByRole("button", { name: "Open North Face, North Woods / Upper Wall" }),
  ).toBeEnabled();
});

test("full results support categories, pagination, filters and clear", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "full-results");
  await expect(
    page.getByRole("button", { name: "Open Cedar Lee, Climbing partner" }),
  ).toBeEnabled();
  await testInfo.attach("full-search-ready", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(
    page.getByRole("button", { name: "Open Cedar Traverse, North Woods / Lower boulders" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Boulder", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open Cedar Crack/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toHaveValue("cedar");
  await page.getByRole("button", { name: "Climbers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Cedar Lee, Climbing partner" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Clear search betabook" }).click();
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toBeFocused();
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toHaveValue("");
});

test("partial failure retries one category while keeping successful results", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "partial-failure");
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("Couldn’t load climbers.");
  await page.getByRole("button", { name: "Retry climbers" }).click();
  await expect(
    page.getByRole("button", { name: "Open Cedar Lee, Climbing partner" }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("area picker binds duplicate names by ID and typing clears selection", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "area-picker");
  const input = page.getByRole("combobox", { name: "Area" });
  await input.fill("cedar");
  await page.getByRole("option").filter({ hasText: "Oregon / Coast Range" }).click();
  await input.press("Tab");
  await expect(page.getByLabel("Selected record")).toHaveAttribute("data-selected-id", "area-3");
  await input.fill("upper");
  await input.press("Tab");
  await expect(page.getByLabel("Selected record")).toHaveCount(0);
});

test("companion picker adds and removes only eligible friends", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "companion-picker");
  const input = page.getByRole("combobox", { name: "Find a friend" });
  await input.fill("cedar");
  await expect(page.getByRole("option", { name: /Cedar West/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Cedar Lee/ }).click();
  await input.press("Tab");
  await expect(page.getByLabel("Selected friends count")).toHaveText("1 friends selected");
  await page.getByRole("button", { name: "Remove Cedar Lee" }).click();
  await expect(page.getByLabel("Selected friends count")).toHaveText("0 friends selected");
});

test("merge picker disables the source climb and chooses a distinct destination", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "merge-picker");
  await expect(
    page.getByRole("button", {
      name: "Choose Cedar Arete, North Woods / Cedar Grove",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Choose Cedar Arete, Coast Range / Cedar Grove", exact: true })
    .click();
  await expect(page.getByLabel("Selected record")).toHaveAttribute("data-selected-id", "climb-106");
});

test("quick search fits a short narrow viewport and passes accessibility", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(page.getByRole("option", { name: "Cedar Lee, Climbing partner" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(dialog.getByRole("combobox")).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "View all results for “cedar”" }),
  ).toBeInViewport();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await testInfo.attach("search-320-short", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("import picker seeds text and requires an explicit area identity", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "import-picker");
  await expect(page.getByRole("searchbox", { name: "Choose a climb" })).toHaveValue("Cedar Arete");
  const area = page.getByRole("combobox", { name: "In area" });
  await expect(area).toHaveValue("Cedar Grove");
  await expect(page.getByRole("button", { name: "Clear area Cedar Grove" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Choose Cedar Arete, Coast Range/ })).toBeEnabled();
  await area.fill("cedar");
  await page.getByRole("option").filter({ hasText: "California / North Woods" }).click();
  await expect(page.getByRole("button", { name: "Clear area Cedar Grove" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Coast Range/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Choose Cedar Arete, North Woods / Cedar Grove",
      exact: true,
    }),
  ).toBeEnabled();
});

test("retry keeps successful sections selectable while the failed section loads", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "partial-failure");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Retry climbers" }).click();
  await expect(page.getByRole("region", { name: "Climbers results" })).toContainText("Searching…");
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeEnabled();
  await page.clock.runFor(350);
  await expect(
    page.getByRole("button", { name: "Open Cedar Lee, Climbing partner" }),
  ).toBeEnabled();
});

for (const story of [
  "quick-initial",
  "quick-loading",
  "quick-no-matches",
  "quick-failed",
  "quick-partial-failure",
]) {
  test(`${story} overlay is accessible`, async ({ page }, testInfo) => {
    await openSearchStory(page, testInfo, story);
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    if (story === "quick-failed") {
      await page.getByRole("button", { name: "Retry climbs" }).click();
      await expect(
        page.getByRole("option", { name: "Cedar Arete, North Woods / Cedar Grove", exact: true }),
      ).toHaveAttribute("aria-disabled", "false");
    }
  });
}

test("sorting and expanded rating and grade filters update actual results", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "full-results");
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await page.getByRole("button", { name: "Sort ascending" }).click();
  const results = page.getByRole("region", { name: "Climbs results" });
  await expect(results.getByRole("button").first()).toHaveAccessibleName(
    "Open Cedar Traverse, North Woods / Lower boulders",
  );
  await page.getByRole("button", { name: "Boulder", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: /Min grade/ }).click();
  await page.getByRole("option", { name: "V4", exact: true }).click();
  await expect(results.getByRole("button", { name: /Coast Range/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Min rating/ }).click();
  await page.getByRole("option", { name: "4", exact: true }).click();
  await expect(results.getByRole("button", { name: /Cedar Traverse/ })).toHaveCount(0);
  await expect(
    results.getByRole("button", {
      name: "Open Cedar Arete, North Woods / Cedar Grove",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(results.getByRole("button", { name: /Coast Range/ })).toBeEnabled();
});

test("changing query clears keyboard selection even when returning to the previous query", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "quick-search");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Search Betabook" });
  await input.fill("cedar crack");
  const crack = page.getByRole("option", { name: "Cedar Crack, North Woods / Upper Wall" });
  await expect(crack).toHaveAttribute("aria-disabled", "false");
  await input.press("ArrowDown");
  await expect(crack).toHaveAttribute("aria-selected", "true");
  await input.fill("north face");
  await expect(
    page.getByRole("option", { name: "North Face, North Woods / Upper Wall" }),
  ).toHaveAttribute("aria-disabled", "false");
  await input.fill("cedar crack");
  await expect(crack).toHaveAttribute("aria-disabled", "false");
  await input.press("Enter");
  await expect(page.getByLabel("Selected record")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search Betabook" })).toHaveValue("cedar crack");
});

test("full filters and climb picker fit 320 pixels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openSearchStory(page, testInfo, "full-results");
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await page.getByRole("button", { name: "Boulder", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("button", { name: /Min grade/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: /Open Cedar Crack/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await testInfo.attach("search-filters-320", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  await openSearchStory(page, testInfo, "merge-picker");
  await expect(
    page.getByRole("button", {
      name: "Choose Cedar Arete, North Woods / Cedar Grove",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await testInfo.attach("search-picker-320", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});

test("journey preserves the field focus ring inside the dialog", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "search-journey");
  await page.getByRole("button", { name: "Search Betabook", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Search Betabook" })).toBeFocused();
  const field = page.locator('[data-slot="search-field-group"]');
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("combobox", { name: "Search Betabook" })).toBeFocused();
  await expect(field).toHaveCSS("box-shadow", /0px 0px 0px 2px/);
  const clipping = await field.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const clipped: string[] = [];
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const bounds = ancestor.getBoundingClientRect();
      if (
        (style.overflowX !== "visible" &&
          (rect.left - 2 < bounds.left - 0.5 || rect.right + 2 > bounds.right + 0.5)) ||
        (style.overflowY !== "visible" &&
          (rect.top - 2 < bounds.top - 0.5 || rect.bottom + 2 > bounds.bottom + 0.5))
      )
        clipped.push(ancestor.getAttribute("data-slot") ?? ancestor.tagName);
    }
    return clipped;
  });
  expect(clipping).toEqual([]);
  await testInfo.attach("journey-keyboard-focus", {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});

test("opening search with the pointer keeps autofocus without the blue box", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "search-journey");
  const trigger = page.getByRole("button", { name: "Search Betabook", exact: true });
  if (testInfo.project.use.hasTouch) await trigger.tap();
  else await trigger.click();
  const input = page.getByRole("combobox", { name: "Search Betabook" });
  await expect(input).toBeFocused();
  await expect(page.locator('[data-slot="search-field-group"]')).not.toHaveCSS(
    "box-shadow",
    /0px 0px 0px 2px/,
  );
  await testInfo.attach("journey-pointer-focus", {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});

test("integrated category Retry preserves successful results", async ({ page }, testInfo) => {
  await openSearchStory(page, testInfo, "network-retry");
  await expect(page.getByRole("alert")).toHaveText("Couldn’t load climbers.");
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Retry climbers" }).click();
  await expect(
    page.getByRole("button", { name: "Open Cedar Lee, Climbing partner" }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("integrated pagination Retry appends records without replacing earlier results", async ({
  page,
}, testInfo) => {
  await openSearchStory(page, testInfo, "pagination-retry");
  await page.getByRole("button", { name: "Climbs", exact: true }).click();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("alert")).toContainText("Couldn't load more");
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Cedar Traverse, North Woods / Lower boulders" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Cedar Arete, North Woods / Cedar Grove", exact: true }),
  ).toHaveCount(1);
});

test("app area lookup binds duplicate identities and clears them when edited", async ({
  page,
}, testInfo) => {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=components-search-area-lookup--selection&viewMode=story&globals=theme:${theme}`,
  );
  const input = page.getByRole("combobox", { name: "Area" });
  await input.fill("cedar");
  await page.getByRole("option").filter({ hasText: "Oregon / Coast Range" }).click();
  await input.press("Tab");
  await expect(page.getByLabel("Selected area identity")).toHaveText("3");
  await input.fill("upper");
  await input.press("Tab");
  await expect(page.getByLabel("Selected area identity")).toHaveText("None");
});
