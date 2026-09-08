import { appBaseURL } from "./app-server";
import { expect, test, openStory } from "./story";

test("auth and recovery pages use the canonical page title", async ({ page }, info) => {
  for (const [path, title] of [
    ["/sign-in", "Sign in"],
    ["/sign-up", "Sign up"],
    ["/forgot-password", "Forgot password"],
    ["/reset-password", "Invalid reset link"],
  ]) {
    await page.goto(`${appBaseURL}${path}`);
    const heading = page.getByRole("heading", { level: 1, name: title, exact: true });
    await expect(heading).toHaveCSS("font-size", "30px");
    await expect(heading).toHaveCSS("font-family", /barlow/i);
    await expect(heading).toHaveCSS("font-weight", "600");
    await info.attach(title, {
      // Hiding carets mutates SSR input styles and can race React hydration.
      body: await page.screenshot({ animations: "disabled", caret: "initial" }),
      contentType: "image/png",
    });
  }
});

test("tag feedback is associated, readable and uses the invalid field treatment", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-tag-input--journal-tags");
  const input = page.getByRole("textbox", { name: "Add a tag" });
  await input.fill("bad!");
  await input.press("Enter");
  await expect(input).toHaveAccessibleDescription(
    "Tags can only contain letters, numbers and hyphens.",
  );
  const error = page.getByRole("alert");
  await expect(error).toHaveText("Tags can only contain letters, numbers and hyphens.");
  await expect(error).toHaveCSS("font-size", "14px");
  await expect(error).toHaveCSS("font-family", /geist/i);
  await expect(input).toHaveAttribute("data-invalid", "true");
  await expect(input).toHaveCSS("box-shadow", /0px 0px 0px 2px/);
  await expect(input).toBeFocused();
  await input.fill("hangboard");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "Remove tag hangboard" })).toBeVisible();
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(error).toHaveCount(0);
  await expect(input).toHaveAccessibleDescription(/Up to 8 tags/);
  await input.press("Shift+Tab");
  const remove = page.getByRole("button", { name: "Remove tag hangboard" });
  await expect(remove).toBeFocused();
  await expect(remove).toHaveCSS("box-shadow", /0px 0px 0px 2px/);
  await page.keyboard.press("Enter");
  await expect(remove).toHaveCount(0);
});

test("privacy field labels and errors follow HeroUI field semantics", async ({ page }, info) => {
  await openStory(page, info, "components-account-privacy-fields--privacy-error");
  const label = page.getByText("Send commentary", { exact: true });
  await expect(label).toHaveCSS("font-size", "14px");
  const trigger = page.getByRole("button", { name: /Send commentary audience/ });
  await expect(trigger).toHaveAccessibleDescription(/Could not save commentary/);
  await expect(trigger).toHaveCSS("outline-width", "1px");
  const errorColor = await page
    .getByText("Could not save commentary. Try again.")
    .evaluate((element) => getComputedStyle(element).color);
  await expect(label).toHaveCSS("color", errorColor);
  await trigger.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("Friends");
});

test("sort direction matches its field size and works from the keyboard", async ({
  page,
}, info) => {
  await openStory(page, info, "components-inputs-sort-select--default");
  const select = page.getByRole("button", { name: /Sort by/ });
  const direction = page.getByRole("button", { name: "Sort ascending", exact: true });
  const label = page.getByText("Sort by", { exact: true });
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS("font-size", "12px");
  const labelBox = await label.boundingBox();
  const selectBox = await select.boundingBox();
  const directionBox = await direction.boundingBox();
  if (!labelBox || !selectBox || !directionBox) throw new Error("Sort controls must be rendered.");
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(selectBox.y);
  expect(labelBox.x).toBeCloseTo(selectBox.x, 0);
  expect(directionBox.y).toBeCloseTo(selectBox.y, 0);
  const height = await select.evaluate((element) => getComputedStyle(element).height);
  await expect(direction).toHaveCSS("height", height);
  await expect(direction).toHaveCSS("width", height);
  await select.focus();
  await page.keyboard.press("Tab");
  await expect(direction).toBeFocused();
  await expect(direction).toHaveCSS("box-shadow", /0px 0px 0px 2px/);
  await page.keyboard.press("Enter");
  await expect(page.locator("output")).toHaveText("name_desc");
  await expect(page.getByRole("button", { name: "Sort descending" })).toBeFocused();
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--field-border-width", "4px"),
  );
  const borderedHeight = await select.evaluate((element) => getComputedStyle(element).height);
  const descending = page.getByRole("button", { name: "Sort descending" });
  await expect(descending).toHaveCSS("height", borderedHeight);
  await expect(descending).toHaveCSS("width", borderedHeight);
});

test("pagination announces failures and exposes the retry description", async ({ page }, info) => {
  await openStory(page, info, "components-feedback-load-more-button--retry");
  const retry = page.getByRole("button", { name: "Load more" });
  await expect(page.getByRole("alert")).toHaveText("Couldn't load more — try again.");
  await expect(retry).toHaveAccessibleDescription("Couldn't load more — try again.");
  await retry.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Next page loaded.");
  await expect(retry).toBeFocused();
});

test("pending pagination preserves focus and prevents duplicate requests", async ({
  page,
}, info) => {
  await openStory(page, info, "components-feedback-load-more-button--loading");
  const pending = page.getByRole("button", { name: "Loading…" });
  await expect(pending).toBeDisabled();
  await pending.focus();
  await expect(pending).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("output")).toHaveText("Requests: 0");
  await page.getByRole("button", { name: "Finish sample request" }).click();
  await page.getByRole("button", { name: "Load more" }).press("Enter");
  await expect(pending).toBeFocused();
  await expect(page.locator("output")).toHaveText("Requests: 1");
  await page.keyboard.press("Enter");
  await expect(page.locator("output")).toHaveText("Requests: 1");
});

test("search and sort field boxes align below the sort label", async ({ page }, info) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await openStory(page, info, "components-filters-sends-toolbar--default");
  const search = await page
    .locator('[data-slot="search-field-group"]')
    .filter({ has: page.getByPlaceholder("Filter sends…") })
    .boundingBox();
  const sort = await page.getByRole("button", { name: /Sort by/ }).boundingBox();
  if (!search || !sort) throw new Error("Both field boxes must be rendered.");
  expect(search.y).toBeCloseTo(sort.y, 0);
  expect(search.y + search.height).toBeCloseTo(sort.y + sort.height, 0);
});

test("search, sort, and direction controls share a responsive field height", async ({
  page,
}, info) => {
  await openStory(page, info, "components-filters-sends-toolbar--default");
  const search = page
    .locator('[data-slot="search-field-group"]')
    .filter({ has: page.getByPlaceholder("Filter sends…") });
  const sort = page.getByRole("button", { name: /Sort by/ });
  const direction = page.getByRole("button", { name: "Sort descending", exact: true });
  for (const borderWidth of [null, "4px"]) {
    if (borderWidth) {
      await page.evaluate(
        (width) => document.documentElement.style.setProperty("--field-border-width", width),
        borderWidth,
      );
    }
    const height = await search.evaluate((element) => getComputedStyle(element).height);
    await expect(sort).toHaveCSS("height", height);
    await expect(direction).toHaveCSS("height", height);
  }
});
