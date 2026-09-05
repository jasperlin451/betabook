import type { ComponentType } from "react";

export type ProductTourPageProps = {
  section: string;
  href: (stepId: string) => string;
};

export type ProductTourPage = ComponentType<ProductTourPageProps>;
