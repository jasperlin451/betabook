"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { SearchSelectionField } from "@/components/search/search-selection-field";
import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useSearchLookup, type LookupFetcher } from "@/hooks/use-search-lookup";
import { MAX_JOURNAL_COMPANIONS, type CompanionOption } from "@/lib/journal-companions";

async function fetchFriends(query: string, signal: AbortSignal): Promise<CompanionOption[]> {
  const response = await fetch(`/api/friends/companions?q=${encodeURIComponent(query)}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Friend lookup failed");
  const data = (await response.json()) as { friends: CompanionOption[] };
  return data.friends;
}

export function CompanionPicker({
  value,
  onChange,
  disabled = false,
  editing = false,
  fetcher = fetchFriends,
}: {
  value: CompanionOption[];
  onChange: (value: CompanionOption[]) => void;
  disabled?: boolean;
  editing?: boolean;
  fetcher?: LookupFetcher<CompanionOption>;
}) {
  const [query, setQuery] = useState("");
  const [cleared, setCleared] = useState(false);
  const full = value.length >= MAX_JOURNAL_COMPANIONS;
  const lookup = useSearchLookup({
    query,
    enabled: !disabled && !full,
    scope: value.map((friend) => friend.id).join(","),
    fetcher: async (text, signal) =>
      (await fetcher(text, signal)).filter(
        (friend) => !value.some((selected) => selected.id === friend.id),
      ),
  });
  return (
    <fieldset
      disabled={disabled}
      aria-label="With friends"
      className={`${FIELD_WIDTH_CLASS.long} flex flex-col gap-2`}
    >
      {value.length > 0 && (
        <ul aria-label="Selected friends" className="flex flex-wrap gap-2">
          {value.map((friend) => (
            <li key={friend.id} className="max-w-full min-w-0">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={disabled}
                aria-label={`Remove friend ${friend.name}`}
                onPress={() => onChange(value.filter((item) => item.id !== friend.id))}
                className="max-w-full"
              >
                <span className="truncate">{friend.name}</span>
                <span aria-hidden>×</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <SearchSelectionField
        emptyMessage="No matching friends. Try a more specific name."
        errorMessage="Couldn’t load friends. Your selections are kept."
        label="Find a friend to tag"
        labelSuffix={
          <HelpTooltip label="About With friends">
            For this entry only. Friends log their own activity; tags don’t grant access. Visibility
            follows both journals’ privacy settings.
            {editing && " Changes replace all tags, including hidden ones."}
          </HelpTooltip>
        }
        placeholder="Find a friend to tag…"
        query={query}
        isDisabled={disabled || full}
        usage={{ used: value.length, limit: MAX_JOURNAL_COMPANIONS, unit: "friends" }}
        helper={full ? "Remove a friend to add another." : undefined}
        status={lookup.status}
        onRetry={lookup.retry}
        onQueryChange={(text) => setQuery(text.slice(0, 100))}
        items={lookup.items.map((friend) => ({
          kind: "climber",
          id: friend.id,
          name: friend.name,
          detail: "Friend",
        }))}
        onSelect={(item) => {
          const friend = lookup.items.find((candidate) => candidate.id === item.id);
          if (
            friend &&
            !disabled &&
            !full &&
            !value.some((selected) => selected.id === friend.id)
          ) {
            setCleared(false);
            onChange([...value, friend]);
            setQuery("");
          }
        }}
      />
      {editing && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          isDisabled={disabled}
          onPress={() => {
            onChange([]);
            setQuery("");
            setCleared(true);
          }}
        >
          Clear friend tags
        </Button>
      )}
      {cleared && (
        <p role="status" className="text-xs text-muted">
          Friend tags will be cleared when you save.
        </p>
      )}
    </fieldset>
  );
}
