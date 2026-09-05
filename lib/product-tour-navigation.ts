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
function getProductTourSteps(
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

export type ProductTourNavigation = {
  from: "journal" | "account";
  mode: "full" | "updates";
};

export type ProductTourSearchParams = {
  from?: string | string[];
  mode?: string | string[];
};

/** One allowlist and duplicate policy for server search params and client getAll() values. */
export function parseProductTourNavigation(params: ProductTourSearchParams): ProductTourNavigation {
  function single(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
  }
  const from = single(params.from) === "account" ? "account" : "journal";
  return {
    from,
    mode: from !== "account" && single(params.mode) === "updates" ? "updates" : "full",
  };
}

/** One policy for invitations and playback, including stale update links and explicit replay. */
export function resolveProductTour(
  catalog: readonly ProductTourStepDefinition[],
  {
    version,
    savedVersion = 0,
    navigation = { from: "journal", mode: "full" },
  }: {
    version: number;
    savedVersion?: number;
    navigation?: ProductTourNavigation;
  },
) {
  const unseenSteps = getProductTourSteps(catalog, version, savedVersion);
  const shouldInvite = savedVersion < version && unseenSteps.length > 0;
  const requested = parseProductTourNavigation(navigation);
  const mode =
    requested.mode === "updates" && savedVersion > 0 && shouldInvite ? "updates" : "full";
  return {
    shouldInvite,
    navigation: { from: requested.from, mode } satisfies ProductTourNavigation,
    steps: mode === "updates" ? unseenSteps : getProductTourSteps(catalog, version),
  };
}

export function productTourPath(
  tourId: ProductTourId,
  options: Partial<ProductTourNavigation> & { stepId?: string } = {},
) {
  const steps = PRODUCT_TOUR_STEPS[tourId];
  const step = steps.find((entry) => entry.id === options.stepId) ?? steps[0];
  const { from, mode } = parseProductTourNavigation(options);
  const query = new URLSearchParams();
  if (from === "account") query.set("from", "account");
  if (mode === "updates") query.set("mode", "updates");
  const search = query.toString();
  return `/tutorial/${tourId}/${step.id}${search ? `?${search}` : ""}`;
}

export function productTourExitPath(userId: string, from: ProductTourNavigation["from"]) {
  return from === "account" ? "/account" : `/users/${userId}/journal`;
}
