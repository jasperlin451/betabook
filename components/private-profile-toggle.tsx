"use client";

import { Checkbox } from "@heroui/react";
import { useState, useTransition } from "react";

import { setUserPrivate } from "@/actions";

/** The account-page control for lib/user-visibility.ts's flag. Applies
 * optimistically and rolls back on failure rather than waiting on the
 * round trip, matching the checkbox feel elsewhere in the app (e.g.
 * send-form.tsx's "Skip rating"). */
export function PrivateProfileToggle({ initialIsPrivate }: { initialIsPrivate: boolean }) {
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setIsPrivate(next);
    setError(null);
    startTransition(async () => {
      const result = await setUserPrivate(next);
      if (!result.ok) {
        setIsPrivate(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Checkbox isSelected={isPrivate} onChange={handleChange}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Private profile
        </Checkbox.Content>
      </Checkbox>
      <p className="text-xs text-muted">
        Hides your profile and sends from everyone but you. Your sends still count toward each
        climb&apos;s community rating and suggested grade.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
