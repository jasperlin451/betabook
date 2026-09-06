import { Button } from "@heroui/react";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

declare const STORYBOOK_COMPONENT_FILES: string[];
// Keys are source modules; values point to an example using their real exports.
// This is a discovery aid, not a claim that one story covers every state.
const examples: Record<string, string> = {
  "brand.tsx": "components-navigation-brand--navigation",
  "mobile-app-helper-panel.tsx": "components-feedback-mobile-app-helper--instructions",
  "send-fields.tsx": "patterns-send-details--send-details",
  "filter-toolbar.tsx": "components-inputs-filter-toolbar--filters",
  "discipline-chips.tsx": "components-inputs-filter-toolbar--filters",
  "discipline-grade-sliders.tsx": "components-inputs-filter-toolbar--filters",
  "grade-histogram.tsx": "components-charts-grade-histogram--area-histogram",
  "ui/actions-menu.tsx": "components-navigation-actions-menu--actions",
  "ui/app-link.tsx": "components-navigation-app-link--default",
  "ui/card.ts": "patterns-layout-and-feedback--panels",
  "ui/choice-pill.tsx": "patterns-control-comparisons--choices",
  "ui/clamped-comment.tsx": "components-data-display-clamped-comment--long",
  "ui/collapsible-section.tsx": "components-layout-collapsible-section--responsive-section",
  "ui/confirm-delete-dialog.tsx": "components-feedback-confirm-delete-dialog--delete-confirmation",
  "ui/date-picker-field.tsx": "components-inputs-date-picker-field--dates",
  "ui/discipline-chip.tsx": "components-data-display-discipline-chip--boulder",
  "ui/empty-state.tsx": "components-feedback-empty-state--no-results",
  "ui/eyebrow.tsx": "components-data-display-eyebrow--with-icon",
  "ui/field.ts": "patterns-forms--forms",
  "ui/grade.tsx": "components-data-display-grade--boulder",
  "ui/index-select.tsx": "components-inputs-index-select--default",
  "ui/layout.ts": "patterns-layout-and-feedback--panels",
  "ui/list-row.tsx": "components-data-display-list-row--default",
  "ui/load-more-button.tsx": "components-feedback-load-more-button--retry",
  "ui/not-found-message.tsx": "components-feedback-not-found-message--not-found",
  "ui/option-select.tsx": "components-inputs-option-select--default",
  "ui/page-shell.tsx": "components-layout-sidebar-layout--right",
  "ui/progress-bar.tsx": "components-feedback-progress-bar--progress",
  "ui/rating-stars.tsx": "components-data-display-rating-stars--ratings",
  "ui/search-combobox.tsx": "components-inputs-search-combobox--search",
  "ui/segmented-buttons.tsx": "components-inputs-segmented-buttons--default",
  "ui/skeleton.tsx": "components-feedback-skeleton--default",
  "ui/sort-select.tsx": "components-inputs-sort-select--default",
  "ui/stat-strip.tsx": "components-data-display-stat-strip--statistics",
  "ui/typography.tsx": "components-data-display-typography--page-heading",
  "ui/user-avatar.tsx": "components-data-display-user-avatar--avatars",
  "ascent-style.tsx": "patterns-climbing-data--labels-and-grades",
  "analytics-grade-pyramid.tsx": "components-charts-grade-pyramid--grade-pyramid",
  "analytics-stat-tiles.tsx": "patterns-profile-overview--profile",
  "area-breadcrumb.tsx": "patterns-navigation--area-navigation",
  "breadcrumbs.tsx": "patterns-navigation--area-navigation",
  "climbing-calendar.tsx": "components-charts-climbing-calendar--calendar",
  "feed-day-card.tsx": "components-journal-feed-day-card--activity-feed",
  "friend-request-badge.tsx": "patterns-navigation--navigation",
  "import/wizard-steps.tsx": "components-import-wizard-steps--import-steps",
  "journal/tag-input.tsx": "components-journal-tag-input--journal-tags",
  "logged-grade-histogram.tsx": "components-charts-logged-grade-histogram--logged-grades",
  "privacy-fields.tsx": "components-account-privacy-fields--privacy",
  "profile-heading.tsx": "patterns-profile-overview--profile",
  "profile-tabs.tsx": "patterns-navigation--navigation",
  "progression-chart.tsx": "components-charts-progression-chart--progression",
  "search-mode-switch.tsx": "patterns-navigation--navigation",
  "subarea-rail.tsx": "patterns-navigation--area-navigation",
};
const nonvisual = new Set([
  "ui/json-ld.tsx",
  "friend-requests-provider.tsx",
  "viewer-boundary.tsx",
  "product-tours/registry.ts",
  "product-tours/types.ts",
  "product-tours/use-tour-frame.ts",
  "product-tours/use-tour-target.ts",
]);
export function CoveragePage() {
  const [gapsOnly, setGapsOnly] = useState(false);
  const files = STORYBOOK_COMPONENT_FILES;
  const covered = files.filter((file) => examples[file]);
  const gaps = files.filter((file) => !examples[file] && !nonvisual.has(file));
  return (
    <StoryPage
      title="Component coverage"
      description="This inventory is generated from the components directory when Storybook starts or builds. A new source file appears as needing a story until linked here. Restart the dev server after adding files."
    >
      <p>
        {covered.length} modules have examples · {gaps.length} need examples ·{" "}
        {files.filter((file) => nonvisual.has(file)).length} nonvisual modules.
      </p>
      <p className="text-sm text-muted">
        An example is not exhaustive workflow coverage. Profile navigation, for example, covers the
        presentation export, not authenticated request loading. Account actions, drawers,
        moderation, full import and journal workflows still need fixtures at their service
        boundaries. Their existing application tests remain necessary.
      </p>
      <Button variant="outline" aria-pressed={gapsOnly} onPress={() => setGapsOnly(!gapsOnly)}>
        {gapsOnly ? "Show all components" : "Show missing examples"}
      </Button>
      <ul className="divide-y divide-separator">
        {files
          .filter((file) => !gapsOnly || gaps.includes(file))
          .map((file) => (
            <li key={file} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <code className="text-xs break-all">{file}</code>
              {examples[file] ? (
                <a className="link text-sm" href={`./?path=/story/${examples[file]}`} target="_top">
                  View example
                </a>
              ) : (
                <span className="text-xs text-muted">
                  {nonvisual.has(file) ? "Nonvisual" : "Needs a story"}
                </span>
              )}
            </li>
          ))}
      </ul>
    </StoryPage>
  );
}
