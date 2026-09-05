import type { ComponentType } from "react";

import type { ProductTourStepDefinition } from "@/lib/product-tour-navigation";

export type ProductTourPageProps = {
  section: string;
  href: (stepId: string) => string;
  steps: readonly ProductTourStepDefinition[];
};

export type ProductTourPage = ComponentType<ProductTourPageProps>;
