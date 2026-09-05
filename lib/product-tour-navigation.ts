import { PRODUCT_TOURS, type ProductTourId } from "@/lib/product-tour";

export type ProductTourStepDefinition = {
  id: string;
  section: string;
  title: string;
  description: string;
  target: string;
  introducedInVersion: number;
  updatedInVersion?: number;
};

/** Stable targets belong to the view components, never to incidental CSS or text. */
export const PRODUCT_TOUR_STEPS: Record<ProductTourId, readonly ProductTourStepDefinition[]> = {
  journal: [
    {
      id: "journal",
      introducedInVersion: 1,
      section: "Journal",
      title: "Start in Journal",
      description:
        "Use Log for outdoor sessions and training. Your entries keep Sends, Projects, and Analytics up to date.",
      target: "journal-log",
    },
    {
      id: "journal-filters",
      introducedInVersion: 1,
      section: "Journal",
      title: "Find an old entry",
      description:
        "Search your notes or filter by entry type. Tags on entries work as filters too.",
      target: "journal-filters",
    },
    {
      id: "sends",
      introducedInVersion: 1,
      section: "Sends",
      title: "Find your sends",
      description:
        "Your first send of each climb appears here. Repeats stay in Journal. Try sorting by grade or rating.",
      target: "send-sort",
    },
    {
      id: "projects",
      introducedInVersion: 1,
      section: "Projects",
      title: "Pick up where you left off",
      description:
        "Climbs you haven't sent appear here automatically. Open the sessions to review your notes. This list is private.",
      target: "project-sessions",
    },
    {
      id: "analytics",
      introducedInVersion: 1,
      section: "Analytics",
      title: "See your progress",
      description:
        "Dots show each month's hardest send; the line tracks your personal best. Days out count each outdoor date once.",
      target: "analytics-chart",
    },
    {
      id: "account",
      introducedInVersion: 1,
      section: "Account",
      title: "Choose what you share",
      description:
        "Your journal starts private. Try these settings to see what visitors see. First-send notes also appear on Sends and follow your profile's privacy settings.",
      target: "privacy-controls",
    },
  ],
};

export function findProductTour(id: string) {
  return PRODUCT_TOURS.find((tour) => tour.id === id);
}

/** Completed and dismissed versions both acknowledge their lessons. Zero means a first visit. */
export function getProductTourSteps(
  steps: readonly ProductTourStepDefinition[],
  version: number,
  acknowledgedVersion = 0,
) {
  return steps.filter(
    (step) =>
      step.introducedInVersion <= version &&
      (step.updatedInVersion !== undefined && step.updatedInVersion <= version
        ? step.updatedInVersion
        : step.introducedInVersion) > acknowledgedVersion,
  );
}

export function productTourPath(
  tourId: ProductTourId,
  stepId?: string,
  from = "journal",
  updates = false,
) {
  const steps = PRODUCT_TOUR_STEPS[tourId];
  const step = steps.find((entry) => entry.id === stepId) ?? steps[0];
  const query = new URLSearchParams();
  if (from === "account") query.set("from", "account");
  if (updates && from !== "account") query.set("mode", "updates");
  const search = query.toString();
  return `/tutorial/${tourId}/${step.id}${search ? `?${search}` : ""}`;
}

export function productTourExitPath(userId: string, from: string | null) {
  return from === "account" ? "/account" : `/users/${userId}/journal`;
}
