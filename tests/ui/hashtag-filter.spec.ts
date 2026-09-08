import type { Page, TestInfo } from "@playwright/test";

import { expect, test, openStory } from "./story";

async function openHashtagStory(page: Page, testInfo: TestInfo) {
  await openStory(page, testInfo, "components-filters-hashtag-filter--default");
  return page.getByRole("combobox", { name: "Hashtag" });
}

test("hashtag suggestions support keyboard selection and show the selected tags", async ({
  page,
}, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.fill("#TRI");
  await expect(page.getByRole("option", { name: "#trip", exact: true })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("#");
  await expect(
    page.getByRole("button", { name: "Remove hashtag trip", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await input.fill("#project");
  await page.getByRole("option", { name: "#project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove hashtag project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove hashtag trip", exact: true })).toHaveCount(
    1,
  );
  await expect(input).toHaveValue("#");
  await expect(page.getByText("No matching hashtags.", { exact: true })).toHaveCount(0);
  // Wait for the exiting suggestions to unmount before capturing selected tags.
  await expect(page.getByRole("listbox", { includeHidden: true })).toHaveCount(0);
  const screenshot = testInfo.outputPath("hashtag-selected.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await testInfo.attach("hashtag-selected", { path: screenshot, contentType: "image/png" });
});

test("the caret and text selection stay after the hashtag prefix", async ({ page }, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.fill("#trip");
  await input.press("Home");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.press("ArrowLeft");
  await input.press("Backspace");
  await expect(input).toHaveValue("#trip");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("a");
  await expect(input).toHaveValue("#atrip");
  await input.press("End");
  await input.press("Shift+Home");
  await expect
    .poll(() =>
      input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
    )
    .toEqual([1, 6]);
  await input.press("Backspace");
  await expect(input).toHaveValue("#");
  await input.fill("#trip");
  await input.press("Escape");
  await input.click({ position: { x: 4, y: 15 } });
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("a");
  await expect(input).toHaveValue("#atrip");
  await input.press("ControlOrMeta+a");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("project");
  await expect(input).toHaveValue("#project");
  await input.fill("#missing");
  await input.press("Escape");
  await input.press("ArrowUp");
  await expect
    .poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart))
    .toBeGreaterThanOrEqual(1);
});

test("browsing hashtag suggestions protects the caret and shows the reopened menu", async ({
  page,
}, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.click();
  await expect(page.getByRole("option")).toHaveCount(7);
  await expect(page.getByRole("option", { name: "#outdoors", exact: true })).toBeVisible();
  await input.press("ArrowUp");
  await expect
    .poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart))
    .toBeGreaterThanOrEqual(1);
  await page.getByRole("option", { name: "#outdoors", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove hashtag outdoors" })).toBeVisible();
  await input.click();
  await expect(page.getByRole("option")).toHaveCount(6);
  const screenshot = testInfo.outputPath("hashtag-browse.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await testInfo.attach("hashtag-browse", { path: screenshot, contentType: "image/png" });
});

test("hashtag field has no search icon", async ({ page }, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await expect(input).toHaveCSS("background-image", "none");
});

for (const scenario of [
  {
    name: "Journal",
    story: "components-filters-journal-toolbar--default",
    role: "searchbox" as const,
    label: "Filter journal",
  },
  {
    name: "Sends toolbar",
    story: "components-filters-toolbar--hashtags",
    role: "textbox" as const,
    label: "Filter climbs",
  },
]) {
  test(`${scenario.name} text filter stays anchored as selected hashtags wrap below the field`, async ({
    page,
  }, testInfo) => {
    await openStory(page, testInfo, scenario.story);
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    const textFilter = page.getByRole(scenario.role, { name: scenario.label });
    const hashtag = page.getByRole("combobox", { name: "Hashtag" });
    await expect(hashtag).toBeVisible();
    const before = await textFilter.boundingBox();
    const hashtagBefore = await hashtag.boundingBox();
    for (const tag of ["power", "strength", "trip"]) {
      await hashtag.fill(`#${tag}`);
      await hashtag.press("Space");
      await expect(
        page.getByRole("button", { name: `Remove hashtag ${tag}`, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("listbox")).toHaveCount(0);
    expect((await textFilter.boundingBox())?.y).toBe(before?.y);
    expect((await hashtag.boundingBox())?.y).toBe(hashtagBefore?.y);
    const screenshot = testInfo.outputPath("hashtag-toolbar-wrapped.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("hashtag-toolbar-wrapped", {
      path: screenshot,
      contentType: "image/png",
    });
  });
}

test("Journal filtering and record search use the same field height", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "components-search-input--input");
  const route = page.getByRole("searchbox", { name: "Search climbs" });
  await expect(route).toBeVisible();
  const height = await route.evaluate((node) => node.parentElement?.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(0);
  await openStory(page, testInfo, "components-filters-journal-toolbar--default");
  const journal = page.getByRole("searchbox", { name: "Filter journal" });
  await expect(journal).toBeVisible();
  expect(await journal.evaluate((node) => node.parentElement?.getBoundingClientRect().height)).toBe(
    height,
  );
});
