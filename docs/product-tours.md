# In-page product tours

Tours run at `/tutorial/[tourId]/[stepId]` inside the app shell. The page uses Alex Morgan's sample data and the same profile heading, tabs, sidebar layouts, list rows, and charts as the app. An outline identifies one control. The short guide has its own column on wide screens and its own row below the demo on smaller screens. It must never cover the demo or dim its content.

## Add a step or feature

1. Add a step to `PRODUCT_TOUR_STEPS` in `lib/product-tour-navigation.ts`: a stable `id`, `section`, `title`, short `description`, and `target`. Keep each callout to one explanation. Do not repeat its text inside the demo.
2. Add `data-tour-target="your-target"` to the relevant control or small group in the feature view. Avoid targeting a whole page or a long list. Targets must be visible and unique within the view; do not select them by CSS classes or translated text.
3. Render the section in the feature's page component. `ProductTourPageProps` supplies its section and `href(stepId)` for links that preserve the replay destination. Reuse the app's layouts and display components. Keep demo controls local and never pass sample IDs to real links or mutation components.
4. For a separate tour, register its metadata in `lib/product-tour.ts`, steps in `PRODUCT_TOUR_STEPS`, and a lazy page loader in `components/product-tours/registry.ts`. The existing route layout handles the rest. An optional quick action beside the invitation belongs in `quick-actions.tsx`.

The Journal tour covers Log, journal filters, Sends sorting, project history, Analytics, and privacy. The sample Log control explains the entry types without opening a real mutation form. Users can log real entries from the invitation's ordinary Log button or their own Journal after leaving the tour.

## Navigation and overlays

The URL owns the current step. Next, Back, profile tabs, the All tutorials menu, refresh, and browser history all resolve through the same step catalog. The persistent route layout loads the feature once and suspends the mobile installation helper while mounted. Each section's local demo state resets when leaving that section.

The guide and demo are separate, nonmodal regions. The demo scrolls independently and has a tab stop for keyboard scrolling. The step heading receives focus, Escape exits, and the close button is always available. Each step shows its explanation directly. Back, Next, and All tutorials stay outside the guide's scrolling text area.

The frame fits below the app header and responds to changes in the visual viewport. New targets scroll into view with space for nearby results. Expanded controls are revealed with the smallest necessary scroll. The target outline follows scrolling and is clipped to the demo pane, so it cannot draw over the guide or app navigation. Missing or offscreen targets hide the outline while the guide stays usable.

Exit returns to Account for Account replay and otherwise to the user's Journal. These destinations are derived from the authenticated account, not arbitrary return URLs. Finishing saves completion and opens the user's Journal. The route is authenticated, rejects unknown tour/step IDs, and is not indexable.

## Sample account

`lib/product-tour-demo.ts` defines Alex Morgan's browser-only fixtures. Journal entries are the source for sends, projects, and analytics; analytics use the production calculation. No database demo account is needed. Negative sample IDs must never enter entity links, real forms, or actions. The only tour mutation is saving the authenticated user's dismissal/completion status.

## Progress and replay

`user_product_tours` stores a version and dismissed/completed status for each user and tour. Existing atomic updates prevent stale tabs from downgrading completed or newer progress. An invitation appears on the owner's Journal when that version has not been dismissed or completed. Account always offers replay; replay does not clear saved progress. Closing a tour does not mark it complete. Loading and completion failures have retry controls.

Use a version bump only when previous users should receive another invitation. This unreleased tour stays on version 1 during the overlay redesign. Adding a new tour ID tracks progress independently and needs no schema change.

## Verify changes

- Check invitations, Account replay, Exit, Finish, direct links, refresh, and browser Back/Forward.
- Check each target at desktop and phone widths in both themes, including scroll, keyboard focus, Escape, and short viewports. The guide and demo must not overlap, including when the step chooser or a demo disclosure is open.
- Exercise filters, sorting, project disclosure, chart explanation, and privacy toggles. Check that no sample data or settings reach the real account.
- Test step/route validation and positioning logic. Keep the existing persistence tests. Run `pnpm check` and the Cloudflare production build before updating the PR.
