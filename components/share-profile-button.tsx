"use client";

import { Button, Tooltip, useMediaQuery } from "@heroui/react";
import { Check, Share } from "lucide-react";
import { useEffect, useState } from "react";

export function ShareProfileButton({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 640px)", { initializeWithValue: false });

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => {
      setTooltipOpen(false);
      setMessage("");
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <>
      <Tooltip.Root isOpen={tooltipOpen} onOpenChange={setTooltipOpen}>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="Copy profile link"
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(
                new URL(`/users/${userId}`, window.location.origin).href,
              );
              setMessage("Profile link copied");
            } catch {
              setMessage("Couldn't copy the link. Try again.");
            }
            setTooltipOpen(true);
          }}
        >
          {message === "Profile link copied" ? (
            <Check aria-hidden="true" className="size-5" />
          ) : (
            <Share aria-hidden="true" className="size-5" />
          )}
        </Button>
        <Tooltip.Content placement={desktop ? "bottom end" : "right"} offset={8}>
          {message || "Copy profile link"}
        </Tooltip.Content>
      </Tooltip.Root>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
