# Product tours and component showcases

The tour system handles navigation, replay, and saved progress. Each feature supplies its own steps, which can show a component with sample data, link to a page, or walk someone through using the feature. Tours are optional.

## Add a tour

1. Add metadata to `PRODUCT_TOURS` in `lib/product-tour.ts`: a stable ID, integer version, name, and invitation copy. IDs identify features; versions identify substantial changes to that feature's tour. Do not rename an existing ID to edit its copy.
2. Create a module under `components/product-tours/` exporting a nonempty array of `ProductTourStep`. Give every step a stable, unique ID, title, eyebrow, and React `Content` component.
3. Add a dynamic loader to `PRODUCT_TOUR_LOADERS` in `components/product-tours/registry.ts`. The exhaustive ID mapping makes a missing loader a type error. Each tour's components load only when that tour is opened.
4. Optionally add a quick action beside the invitation in `quick-actions.tsx`. Most component showcases don't need one.

A basic step only needs content:

```tsx
import type { ProductTourStep } from "@/components/product-tours/types";

function FeaturePreview() {
  return <p>Render the new component here with sample props.</p>;
}

export const featureTourSteps: readonly ProductTourStep[] = [
  {
    id: "preview",
    title: "Try the new feature",
    eyebrow: "What's new",
    Content: FeaturePreview,
  },
];
```

The tour keeps Previous, Next, and Finish buttons in a footer below the scrolling content, moves keyboard focus to each step heading, and lets users retry if saving completion fails. Previous/Next buttons name their destination. Set `navigationLabel` for a short name such as “Journal”; otherwise they use the step title. Step components receive the owner's `userId`, temporary `values`, `close()` to leave the tour, and `navigate(stepId, values)` to change steps. Mark a step `navigation: "custom"` when the step handles its own navigation. The last step always offers Finish. Set `canFinish: true` on an earlier overview to let people finish without visiting every optional tutorial. Never navigate back into a submitted form after a successful save; the journal tour moves from the saved result to the tutorial chooser.

Keep sample data in the browser. Steps that save real entries must use the feature's authenticated actions and wait for a successful save before continuing. People can finish a tour without creating an entry. Label real-entry actions clearly, explain that saving changes the user's journal, and link the saved result to their own page. Keep browsing demo tutorials a separate choice.

## Demo account

The Journal, Sends, Projects, Analytics, and Account tutorials share Alex Morgan, a fictional climber defined in `lib/product-tour-demo.ts`. The sample entries are the source for the sends, project history, and analytics. Analytics use the production `buildUserAnalytics` calculation, and previews reuse `ListRow`, `StatTiles`, and `ProgressionChart` alongside local controls.

The demo loads with the tour and needs no database account. It works even when the user's logbook is empty. Example filters and privacy controls use component state and reset when that tutorial is reopened. The Journal preview starts with search, entry-type filters, and three rows. Search and filters use all eight entries; “Show all” expands the list without adding another scroll area. Tags on the sample rows are clickable filters. Negative demo IDs must never be passed to mutation components or real route links. Explicit “Open my …” links use the authenticated viewer's ID and leave the tutorial.

To add another section, put a step and chooser button in `profile-tour-pages.tsx`, then use the same fixture for its sample data. Start with a short introduction explaining what the page is for before showing the demo. `PageTutorial` requires this introduction and places it above both columns on desktop. On mobile, the reading order is introduction, demo, then detailed tips. Keep the introduction focused on the page's purpose and use the tips to explain controls and examples. Update the consistency tests when the data changes. Reuse display components from the app. Replace controls that normally navigate or save with local demo controls, and label the result as an example.

## Eligibility and persistence

`user_product_tours` stores one row per `(user_id, tour_id)`, containing the version the user dismissed or completed. The invitation appears if the user hasn't dismissed or completed the current version. A new ID is independent of all existing progress; adding it requires no database migration. Incrementing one tour's version reintroduces only that tour. Copy edits usually do not need a version bump.

The save action validates IDs and versions against the server registry, derives the account from the authenticated session, and uses an atomic upsert. Stale dismissals cannot downgrade completed progress, and an older deployment cannot overwrite newer-version progress. Replay never clears saved progress. Failures remain visible and retryable.

The first release marks existing accounts with `product_tour_returning` so they get a shorter introduction. Existing sends and journal entries don't count as completing a tour. Future tours can use the same introduction for everyone.

Users see tour invitations on their own Journal page. Account lists tours from the same registry for replay. Visitors never load another user's tour state. The mobile installation helper pauses while a tour is open; this does not change its saved dismissal preference.

## Check a tour

- Check a fresh account, an account with other completed tours, and current and older saved tour versions.
- Exercise Previous/Next/Finish, close/reopen, reload after dismissal/completion, and Account replay.
- Check phone-width layout, keyboard focus, and any links or interactive component behavior.
- Confirm no example data is saved unless the user explicitly submits the real feature form.
- Run `pnpm check` and the production build for the completed change.
