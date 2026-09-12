import { expect, test, openStory } from "./story";

test("goal count, timeframe and shared date picker have matching control heights", async ({
  page,
}, info) => {
  await openStory(page, info, "components-goals-goal-form--seasonal-goal");
  const count = page.locator('input[type="number"]');
  const date = page.locator(".date-input-group");
  const timeframe = page.getByRole("button", { name: "Timeframe" });
  const countBox = await count.boundingBox();
  await expect(date).toHaveCount(2);
  const timeframeBox = await timeframe.boundingBox();
  if (!countBox || !timeframeBox) throw new Error("Expected all three form controls");
  for (const field of await date.all()) {
    const dateBox = await field.boundingBox();
    expect(dateBox?.height).toBe(countBox.height);
  }
  expect(timeframeBox.height).toBe(countBox.height);
  expect(timeframeBox.y).toBe(countBox.y);
});
