# Search and filter consistency review

The shared controls now cover Search climbs, area climbs, Sends, Journal, Analytics year selection, and Log entry field sizing. The Storybook sweep replaces reconstructed toolbar patterns with the real production components, adds expanded and collapsed active-filter states, and documents interactive rating stars and all grade widths.

## Fixed in this change

- Search, area climbs and Sends share a compact 1–5 rating range and a single removable range tag. Full range includes unrated records; narrowed ranges exclude them.
- All grade selectors, including rope and suggested grades, use short fields. Sort choices also use short fields; Dates and Tags use medium fields; query, area and friend fields use long fields.
- Expanded filters align through a shared label column and stack on mobile.
- All filter panels use Expand filters / Hide filters with chevrons and a panel-colored expanded button.
- Applied refinements remain visible as removable tags outside the collapsed panel, with Clear all.
- Tags now share `TagsField` across Journal, Sends, Analytics and Log entry, including the protected # prefix, removable tags and Enter/Space/comma delimiters. Log entry retains new-tag validation and limits; filters retain existing-tag selection.
- Ascent-style search/filter choices use tags, while logging/import boolean checkboxes retain their meaning.
- Storybook Patterns / Filters now renders actual Sends, Journal and area toolbars with a local router boundary. Log entry has visible boulder and rope ascent states. Control comparisons use the actual grade-feel and discipline components.

## Remaining product decisions

1. **Tutorial controls are simplified.** `DemoSends` uses Date/Grade/Rating pills instead of `SortSelect`; the Journal preview has a separate entry-type control. Replace these with shared presentation controls in a tutorial follow-up, preserving local sample data and spotlight targets. Current lesson text does not describe the renamed filter disclosure, so no lesson copy or version is made inaccurate by this change.
2. **Area selection differs by context.** Sends exposes an area lookup in its filters. General Search carries area scope from its search flow and intentionally hides another lookup. Keep this if the scoped-search workflow is intentional; otherwise expose the existing `AreaLookup`, rather than creating another picker.

Search and area pages expose aggregate maximum rating and minimum ascents; Sends filters personal ratings. This is a domain difference, not a component inconsistency. Sort defaults also vary by context and need not be identical.

## Tutorial decision

No new lesson or version is added: these changes refine existing filter and logging controls. Current lessons remain accurate. The simplified preview control mismatch above is explicitly recorded for follow-up rather than silently presenting it as production parity.

## Shared field behavior

- Short fields are 7rem for all grades, Min ascents and sorting; medium fields are 11rem for dates and Tags; long fields are 24rem for queries and lookups. Multiline notes fill their container.
- Sorting stays in its own right-aligned row below expanded filters, with the small Sort by label to the left of the field at every screen size.
- Tags use the helper “Enter, Space, or comma to add.” Log entry shows a live count out of eight beside the label and character restrictions only after invalid input.
- Min ascents is a plain number input, prefilled with 0. Zero means no minimum.
- Rating filters use 16px stars, matching result icons, and only show the group label Rating. Crossing a bound adjusts the other. Result grades and ratings use a muted dot separator, with the number before the star icon.
- Log entry retains discipline filtering without an expanded filter panel. Its single Rating field remains tied to sends; clicking the selected star clears it. Record without a date selects I sent and hides the date; unchecking restores it.
- Analytics places Expand filters beside discipline choices and keeps Tags inside the shared panel. Selected tags remain clearable while collapsed.

See **Patterns / Fields / Standard widths**, **Patterns / Filters**, and the colocated production-component stories for the current examples. Behavioral checks live beside components; browser checks cover field geometry, native editing and visible disclosure treatment.
