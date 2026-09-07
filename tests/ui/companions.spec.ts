import { expect, test, openStory } from "./story";

test("friend-tag guidance is in a tooltip accessible by pointer and keyboard", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, `components-journal-companion-picker--selection`);
  const help = page.getByRole("button", { name: "About With friends", exact: true });
  const tooltip = page.getByRole("tooltip");
  await expect(help).toBeVisible();
  await expect(help).toHaveAttribute("type", "button");
  await expect(tooltip).toBeHidden();
  await expect(page.getByText(/Only for this entry\. Tagging/)).toHaveCount(0);
  if (testInfo.project.use.hasTouch) {
    await help.tap();
  } else {
    await page.mouse.move(1, 1);
    await help.hover();
  }
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Friends log their own activity; tags don’t grant access.");
  await expect(tooltip).toContainText("Visibility follows both journals’ privacy settings.");
  await expect(tooltip).toContainText("Changes replace all tags, including hidden ones.");
  await expect(tooltip).toHaveCSS("word-break", "normal");
  await expect(tooltip).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: testInfo.outputPath("companion-help.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.mouse.move(0, 0);
  await page.getByRole("combobox").focus();
  await expect(tooltip).toBeHidden();
  await page.keyboard.press("Shift+Tab");
  await expect(help).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
});

for (const story of ["selection", "maximum"]) {
  test(`journal friend picker supports ${story}`, async ({ page }, testInfo) => {
    await openStory(page, testInfo, `components-journal-companion-picker--${story}`);
    if (story === "maximum") {
      await expect(page.getByRole("status")).toContainText("All 10 places filled");
      await expect(page.getByRole("combobox")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Remove friend Climbing friend 1", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("9 of 10");
    }
    const input = page.getByRole("combobox", { name: "Find a friend to tag" });
    await input.fill("Alex");
    await expect(page.getByRole("option", { name: "Alex Rivera" })).toBeVisible();
    await input.press("ArrowDown");
    await input.press("Enter");
    // Selecting a friend must dismiss the menu before the selected chips move the field.
    if (story === "selection") {
      await expect(input).toHaveValue("");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(input).toBeFocused();
    }
    await expect(page.getByRole("listbox", { includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove friend Alex Rivera" })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("selected-companions.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Remove friend Alex Rivera" }).click();
    await expect(page.getByRole("button", { name: "Remove friend Alex Rivera" })).toHaveCount(0);
    // This explicit edit also works when all prior selections are now hidden.
    await expect(
      page.getByRole("button", { name: "Clear friend tags", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear friend tags", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("0 of 10");
    await expect(page.getByRole("status")).toContainText(
      "Friend tags will be cleared when you save",
    );
  });
}
test("friend suggestions follow the moved field when adding another friend", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, `components-journal-companion-picker--selection`);
  const input = page.getByRole("combobox", { name: "Find a friend to tag" });
  await input.fill("Alex");
  await page.getByRole("option", { name: "Alex Rivera", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toBeFocused();
  await expect(page.getByRole("listbox", { includeHidden: true })).toHaveCount(0);
  await input.fill("Sam");
  await expect(
    page.getByRole("option", { name: "Sam With A Long Climbing Name", exact: true }),
  ).toBeVisible();
  const field = await input.boundingBox();
  const menu = await page.getByRole("listbox").boundingBox();
  if (!field || !menu) throw new Error("Missing friend field or suggestions");
  expect(menu.y >= field.y + field.height || menu.y + menu.height <= field.y).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("next-friend-suggestions.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("option", { name: "Sam With A Long Climbing Name", exact: true }).click();
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("list", { name: "Selected friends" }).getByRole("button"),
  ).toHaveCount(2);
  await expect(page.getByRole("status")).toContainText("2 of 10");
  await input.fill("zzz");
  await expect(page.getByText("No matching friends. Try a more specific name.")).toBeVisible();
  await input.fill("");
  await expect(input).toHaveAttribute("aria-expanded", "false");
});
test("journal companion removal keeps the other companion visible", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "components-journal-companion-list--companions");
  await page.getByRole("button", { name: "Remove my tag" }).click();
  await expect(page.getByText("With Alex Rivera", { exact: true })).toBeVisible();
  await expect(page.getByText("Sam With A Long Climbing Name")).toHaveCount(0);
});
test("friend lookup errors preserve selection and recover on a new query", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "components-journal-companion-picker--unavailable");
  await expect(
    page.getByRole("button", { name: "Remove friend Sam With A Long Climbing Name" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Couldn't load friends");
  await expect(page.getByRole("status")).toContainText("1 of 10");
  await expect(
    page.getByRole("button", { name: "Remove friend Sam With A Long Climbing Name" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Find a friend to tag" }).fill("Alex R");
  await page.getByRole("option", { name: "Alex Rivera", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove friend Alex Rivera" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove friend Sam With A Long Climbing Name" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("2 of 10");
});
