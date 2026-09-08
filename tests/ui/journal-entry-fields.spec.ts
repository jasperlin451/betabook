import type { Page } from "@playwright/test";

import { expect, test, openStory } from "./story";

async function submissions(page: Page) {
  return JSON.parse(await page.getByRole("status", { name: "Submitted entries" }).innerText()) as {
    undated: boolean;
    fields: [string, string][];
  }[];
}
async function addFriend(page: Page) {
  const input = page.getByRole("combobox", { name: "Find a friend to tag" });
  await input.fill("Sam");
  await page.getByRole("option", { name: "Sam Rivera", exact: true }).click();
  await input.press("Tab");
}

test("send commentary help opens without submitting the form", async ({ page }, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  const help = page.getByRole("button", { name: "About Send commentary", exact: true });
  await expect(help).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
  await expect(help).toHaveAttribute("type", "button");
  await help.scrollIntoViewIfNeeded();
  if (info.project.use.hasTouch) await help.tap();
  else await help.click();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Uses your Send commentary audience wherever this note appears.",
  );
  expect(await submissions(page)).toEqual([]);
  await info.attach("commentary-help", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  await page.getByRole("textbox", { name: "How'd it go?" }).focus();
  await expect(page.getByRole("tooltip")).toBeHidden();
});

for (const story of ["outdoor", "repeat", "training"]) {
  test(`${story} keeps selected friends above notes and ascent fields`, async ({ page }, info) => {
    await openStory(page, info, `components-journal-entry-fields--${story}`);
    await addFriend(page);
    if (story !== "training") {
      await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
      await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeVisible();
    } else {
      await expect(page.getByRole("checkbox", { name: "I sent", exact: true })).toHaveCount(0);
    }
    const friends = await page.getByRole("group", { name: "With friends" }).boundingBox();
    const notes = await page
      .getByRole("textbox", { name: story === "training" ? "What did you do?" : "How'd it go?" })
      .boundingBox();
    if (!friends || !notes) throw new Error("Missing friend picker or note field");
    expect(friends.y + friends.height).toBeLessThan(notes.y);
    if (story === "outdoor") {
      const ascent = await page.getByText("The ascent", { exact: true }).boundingBox();
      if (!ascent) throw new Error("Missing ascent fields");
      expect(friends.y + friends.height).toBeLessThan(ascent.y);
    }
  });
}
