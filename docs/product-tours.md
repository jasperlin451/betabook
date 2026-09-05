# Product tours and component showcases

Tours are optional feature introductions. The first tour teaches journal logging, but the shell has no journal-specific steps or persistence. A future tour can render a new component, a preview using sample props, links into the product, or an interactive workflow.

## Add a tour

1. Add metadata to `PRODUCT_TOURS` in `lib/product-tour.ts`: a stable ID, integer version, name, and invitation copy. IDs identify features; versions identify substantial changes to that feature's tour. Do not rename an existing ID to edit its copy.
2. Create a module under `components/product-tours/` exporting a nonempty array of `ProductTourStep`. Give every step a stable, unique ID, title, eyebrow, and React `Content` component.
3. Add a dynamic loader to `PRODUCT_TOUR_LOADERS` in `components/product-tours/registry.ts`. The exhaustive ID mapping makes a missing loader a type error. Each tour's components load only when that tour is opened.
4. Optionally add a quick action beside the invitation in `quick-actions.tsx`. Most component showcases don't need one.

A basic step only needs content:

```tsx
import type { ProductTourStep } from "@/components/product-tours/types";

function FeaturePreview() {
  return <p>Render the new component here with representative sample props.</p>;
}

export const featureTourSteps: readonly ProductTourStep[] = [
  {
    id: "preview",
    title: "Meet the new feature",
    eyebrow: "What's new",
    Content: FeaturePreview,
  },
];
```

The shared shell supplies Back, Next, and Finish, keyboard-accessible controls, step-heading focus, and completion errors with retry. Content may receive the owner's `userId`, transient `values`, `close()` for links to the product, and `navigate(stepId, values)` for interactive flows. Mark a step `navigation: "custom"` when its content supplies branching controls. The last step always offers Finish. Set `canFinish: true` on an earlier overview to let people finish without visiting every optional tutorial. Never navigate back into a submitted form after a successful save; the journal tour demonstrates a result step that leads forward to orientation.

Treat component previews as previews: sample props must not write application data. Interactive steps must use the feature's ordinary authenticated actions and advance only after success. Tour completion means the person finished the explanation, not that they performed any particular action.

## A connected demo account

The Journal, Sends, Projects, Analytics, and Account tutorials share Alex Morgan, a fictional climber defined in `lib/product-tour-demo.ts`. The sample entries are the source for the sends, project history, and analytics. Analytics use the production `buildUserAnalytics` calculation, and previews reuse `ListRow`, `StatTiles`, and `ProgressionChart` alongside local controls.

The demo exists only in the lazy-loaded tour bundle. It needs no seeded or public account, works on an empty production database, and never inserts sample entries into the viewer's logbook. Example filters and privacy controls use component state and reset when that tutorial is reopened. Negative demo IDs must never be passed to mutation components or real route links. Explicit “Open my …” links use the authenticated viewer's ID and leave the tutorial.

To showcase another section, add a tutorial step and chooser entry in `profile-tour-pages.tsx`, then give its preview representative data from this same fixture. Extend the fixture's cross-page consistency tests when changing the story. Prefer production read-only display components; isolate any control that would normally navigate or save, and label it as an example.

## Eligibility and persistence

`user_product_tours` stores one row per `(user_id, tour_id)`, containing its acknowledged version and dismissed/completed status. Missing or older progress offers an invitation. A new ID is independent of all existing progress; adding it requires no database migration. Incrementing one tour's version reintroduces only that tour. Cosmetic copy fixes generally do not need a version bump.

The save action validates IDs and versions against the server registry, derives the account from the authenticated session, and uses an atomic upsert. Stale dismissals cannot downgrade completed progress, and an older deployment cannot overwrite newer-version progress. Replay never clears saved progress. Failures remain visible and retryable.

The initial rollout marks existing accounts with `product_tour_returning` for shorter invitation copy. This is separate from tour eligibility and journal/send counts: backfilled historical sends never complete a tour. Future tour copy can use identical standard/returning descriptions when that distinction is irrelevant.

Owner Journal pages show eligible invitations. Account derives its replay catalog from the same registry. Visitors never load another user's tour state. The mobile installation helper pauses while a tour is open; this does not change its saved dismissal preference.

## Verify a new showcase

- Check a fresh account, an account with other completed tours, and current/older acknowledged versions.
- Exercise Back/Next/Finish, close/reopen, reload after dismissal/completion, and Account replay.
- Check phone-width layout, keyboard focus, and any links or interactive component behavior.
- Confirm no example data is saved unless the user explicitly submits the real feature form.
- Run `pnpm check` and the production build for the completed change.
