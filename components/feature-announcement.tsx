"use client";

import { useRef, useState } from "react";

import { dismissFeatureAnnouncement } from "@/actions";
import { FeatureCallout, type FeatureCalloutProps } from "@/components/ui/feature-callout";
import { GENERIC_ERROR_MESSAGE, type ActionResult } from "@/lib/action-result";

type Props = Omit<FeatureCalloutProps, "isOpen" | "onDismiss" | "isPending" | "error"> & {
  /** Temporarily hide while the highlighted workflow is open, without dismissing. */
  isEnabled?: boolean;
  featureId: string;
  userId: string;
  initialDismissed: boolean;
  dismissAction?: (featureId: string) => Promise<ActionResult>;
};

/** Load initialDismissed on the server for the signed-in viewer; no flash on revisits. */
export function FeatureAnnouncement(props: Props) {
  return <AnnouncementState key={`${props.userId}:${props.featureId}`} {...props} />;
}

function AnnouncementState({
  featureId,
  initialDismissed,
  isEnabled = true,
  dismissAction = dismissFeatureAnnouncement,
  ...props
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  async function dismiss() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await dismissAction(featureId);
      if (result.ok) setDismissed(true);
      else setError(result.error);
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  return (
    <FeatureCallout
      {...props}
      isOpen={isEnabled && !initialDismissed && !dismissed}
      isPending={pending}
      error={error}
      onDismiss={() => {
        void dismiss();
      }}
    />
  );
}
