import type { ComponentType } from "react";

/** Step content can render a component preview, links, or a real feature flow.
 * Values are transient tour context, never persisted as application data. */
export type ProductTourStepProps = {
  userId: string;
  close: () => void;
  values: Readonly<Record<string, string>>;
  navigate: (stepId: string, values?: Record<string, string>) => void;
};

export type ProductTourStep = {
  id: string;
  title: string;
  /** Short destination name for Previous/Next buttons. Defaults to the step title. */
  navigationLabel?: string;
  eyebrow: string;
  Content: ComponentType<ProductTourStepProps>;
  /** Omit for ordinary Back/Next/Finish controls. Interactive steps supply their own navigation. */
  navigation?: "custom";
  /** Also offer completion at a branching overview before optional deeper tutorials. */
  canFinish?: boolean;
};
