import { expect, test, openStory } from "./story";

for (const scenario of [
  {
    story: "activity-feed",
    count: 3,
    remaining: 0,
    section: "journal",
    climbs: ["Cedar Arete", "Pine Slab"],
  },
  {
    story: "more-activity",
    count: 5,
    remaining: 2,
    section: "journal",
    climbs: ["Cedar Arete", "Pine Slab"],
  },
  { story: "remaining-activity", count: 1, remaining: 1, section: "journal", climbs: [] },
  { story: "sends-only", count: 3, remaining: 2, section: "sends", climbs: ["Cedar Arete"] },
]) {
  test(`${scenario.story} renders the supplied activities and correct day destination`, async ({
    page,
  }, info) => {
    await openStory(page, info, `components-journal-feed-day-card--${scenario.story}`);
    const card = page.getByRole("article");
    await expect(card.locator("header")).toContainText(
      `${scenario.count} ${scenario.count === 1 ? "activity" : "activities"}`,
    );
    await expect(card.locator("time")).toHaveAttribute("datetime", "2026-09-01");
    const destination = `/users/storybook-climber/${scenario.section}?date=2026-09-01`;
    const day = card.getByRole("link", {
      name: "View activity for Alex Rivera on Sep 1, 2026",
      exact: true,
    });
    await expect(day).toHaveAttribute("href", destination);
    const more = card.getByRole("link", { name: /See all activity/ });
    if (scenario.remaining) {
      await expect(more).toHaveText(`See all activity (${scenario.remaining} more)`);
      await expect(more).toHaveAttribute("href", destination);
    } else await expect(more).toHaveCount(0);
    await expect(card.locator('a[href^="/climbs/"]')).toHaveText(scenario.climbs);
    if (scenario.story === "sends-only") {
      await expect(card).toContainText("Linked the moves with a high right foot.");
      await expect(card).not.toContainText("Jordan Lee");
      await expect(card.locator('a[href*="/journal"]')).toHaveCount(0);
    }
  });
}
