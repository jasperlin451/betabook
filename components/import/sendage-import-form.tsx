"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cardClass } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/typography";
import { fetchSendageImport } from "@/lib/sendage-import";
import type { ParsedCsv } from "@/lib/sends-import";

export function SendageImportForm({
  initialUsername = "",
  disabled = false,
  onLoaded,
  onBusyChange,
}: {
  initialUsername?: string;
  disabled?: boolean;
  onLoaded: (parsed: ParsedCsv, username: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [input, setInput] = useState(initialUsername);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  async function load() {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    onBusyChange(true);
    setCount(0);
    setError(null);
    try {
      const result = await fetchSendageImport(input, {
        signal: controller.signal,
        onProgress: (value) => {
          if (!controller.signal.aborted) setCount(value);
        },
      });
      if (controller.signal.aborted) return;
      if (!result.parsed.rows.length) {
        setError("No sends found on this public Sendage profile.");
        return;
      }
      setInput(result.username);
      onLoaded(result.parsed, result.username);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't load sends from Sendage. Please try again.",
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    onBusyChange(false);
  }

  return (
    <section className={`flex flex-col gap-3 ${cardClass("sm", "bordered")}`}>
      <SectionHeading>Import from Sendage</SectionHeading>
      <p className="text-sm text-muted">
        Load sends from your public profile, then review the climb matches. No CSV or Sendage login
        needed. Grades are imported as V grades and YDS.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
        className="flex flex-col gap-3"
      >
        <TextField
          value={input}
          onChange={(value) => {
            setInput(value);
            setError(null);
          }}
          isDisabled={busy || disabled}
          isRequired
        >
          <Label>Sendage username or profile link</Label>
          <Input
            placeholder="sendage.com/user/your-username"
            autoComplete="off"
            spellCheck={false}
          />
        </TextField>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" isDisabled={busy || disabled || !input.trim()}>
            <Download className="size-4" aria-hidden />
            {busy ? "Loading sends…" : "Import from Sendage"}
          </Button>
          {busy && (
            <Button variant="ghost" onPress={cancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {count ? `${count} sends loaded…` : "Connecting to Sendage…"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
