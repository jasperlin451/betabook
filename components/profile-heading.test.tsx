import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ProfileHeading } from "./profile-heading";

it("keeps another climber's name as the profile title", () => {
  const html = renderToStaticMarkup(<ProfileHeading name="Alex Morgan" since={2026} />);
  expect(html).toMatch(/<h1[^>]*>Alex Morgan<\/h1>/);
  expect(html).toContain("Climber");
});
