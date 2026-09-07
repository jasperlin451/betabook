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
async function fillNotes(page: Page, training = false) {
  await page
    .getByRole("textbox", { name: training ? "What did you do?" : "How'd it go?" })
    .fill("Kept the high foot.");
  const tags = page.getByRole("textbox", { name: "Add a tag" });
  await tags.fill("technique");
  await tags.press("Enter");
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
  test(`${story} submits the selected friend identity, note, date and tags`, async ({
    page,
  }, info) => {
    await openStory(page, info, `components-journal-entry-fields--${story}`);
    await addFriend(page);
    await fillNotes(page, story === "training");
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
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Completed saves:" })).toHaveText(
      "Completed saves: 1",
    );
    const saved = await submissions(page);
    expect(saved).toHaveLength(1);
    expect(saved[0].undated).toBe(false);
    expect(saved[0].fields).toEqual([
      ["kind", story === "training" ? "training" : "session"],
      ["entryDate", "2026-09-06"],
      ["body", "Kept the high foot."],
      ...(story === "training"
        ? []
        : [
            ["climbId", "-1"],
            ["sent", "true"],
          ]),
      ["tag", "technique"],
      ["companionsChanged", "true"],
      ["companion", "sample-sam"],
      ...(story === "outdoor"
        ? [
            ["ascentStyle", "redpoint"],
            ["rating", ""],
            ["suggestedGrade", "5"],
            ["gradeFeel", "solid"],
          ]
        : []),
    ]);
  });
}

test("an unknown date blocks saving friends and recovery preserves their identities", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  await addFriend(page);
  await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
  await page.getByRole("checkbox", { name: "I don't remember the date" }).press("Space");
  await page.getByRole("button", { name: "Save send", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Add a date to keep With friends.");
  expect(await submissions(page)).toEqual([]);
  await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeVisible();
  await page.getByRole("checkbox", { name: "I don't remember the date" }).press("Space");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const saved = await submissions(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].undated).toBe(false);
  expect(saved[0].fields.filter(([key]) => key === "companion")).toEqual([
    ["companion", "sample-sam"],
  ]);
});

test("undated sends preserve commentary and omit journal-only tags", async ({ page }, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  await fillNotes(page);
  await page.getByRole("checkbox", { name: "I sent", exact: true }).press("Space");
  await page.getByRole("checkbox", { name: "I don't remember the date" }).press("Space");
  await expect(page.getByRole("textbox", { name: "Add a tag" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save send", exact: true }).click();
  const saved = await submissions(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].undated).toBe(true);
  expect(saved[0].fields).toEqual(
    expect.arrayContaining([
      ["dateSent", ""],
      ["comment", "Kept the high foot."],
      ["climbId", "-1"],
    ]),
  );
  expect(saved[0].fields.filter(([key]) => ["tag", "companion"].includes(key))).toEqual([]);
});

test("failed saves retain entered data and retry the same payload once", async ({ page }, info) => {
  await openStory(page, info, "components-journal-entry-fields--save-failure");
  await addFriend(page);
  await fillNotes(page);
  const save = page.getByRole("button", { name: "Save entry", exact: true });
  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Couldn't save the entry. Try again.");
  await expect(page.getByRole("status").filter({ hasText: "Completed saves:" })).toHaveText(
    "Completed saves: 0",
  );
  await expect(page.getByRole("textbox", { name: "How'd it go?" })).toHaveValue(
    "Kept the high foot.",
  );
  await expect(page.getByRole("button", { name: "Remove tag technique" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeVisible();
  const first = await submissions(page);
  expect(first).toHaveLength(1);
  await save.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Completed saves:" })).toHaveText(
    "Completed saves: 1",
  );
  expect(await submissions(page)).toEqual([first[0], first[0]]);
});

test("a pending save disables repeat submission until the request finishes", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-fields--saving");
  await addFriend(page);
  const save = page.getByRole("button", { name: "Save entry", exact: true });
  await save.press("Enter");
  await expect(save).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remove friend Sam Rivera" })).toBeDisabled();
  await save.press("Enter");
  expect(await submissions(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Finish sample save" }).click();
  await expect(save).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "Completed saves:" })).toHaveText(
    "Completed saves: 1",
  );
});
