import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PrivacyFields } from "@/components/privacy-fields";

function fields(isPrivate = false, isPending = false) {
  return renderToStaticMarkup(
    <PrivacyFields
      isPrivate={isPrivate}
      isPending={isPending}
      journalVisibility="friends"
      sendCommentVisibility="public"
      onProfileChange={() => {}}
      onJournalChange={() => {}}
      onSendCommentChange={() => {}}
    />,
  );
}

it("offers separate commentary and journal audiences on a public profile", () => {
  const html = fields();
  expect(html).toContain("Send commentary");
  expect(html).toContain("Journal entries");
  expect(html.match(/<select\b/g)).toHaveLength(2);
  expect(html.match(/<select\b[^>]*\bdisabled/g) ?? []).toHaveLength(0);
  expect(html).toContain("Public");
  expect(html).toContain("Friends");
});

it("disables both audiences for a private profile and explains the effective privacy", () => {
  const html = fields(true);
  expect(html.match(/<select\b[^>]*\bdisabled/g) ?? []).toHaveLength(2);
  expect(html).toContain("Only you can see your profile and climbing history");
  expect(html).toContain("Your saved audiences will apply when your profile is public");
});

it("disables both audience controls while a privacy change is saving", () => {
  const html = fields(false, true);
  expect(html.match(/<select\b[^>]*\bdisabled/g) ?? []).toHaveLength(2);
});
