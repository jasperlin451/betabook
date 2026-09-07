"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { HelpTooltip } from "@/components/ui/help-tooltip";
import { SearchCombobox } from "@/components/ui/search-combobox";
import type { TypeaheadFetcher } from "@/hooks/use-typeahead";
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
  fetcher?: TypeaheadFetcher<CompanionOption>;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [cleared, setCleared] = useState(false);
  const full = value.length >= MAX_JOURNAL_COMPANIONS;
  return (
    <fieldset disabled={disabled} aria-label="With friends" className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 font-medium">
        <span className="inline-flex items-center gap-1">
          With friends
          <HelpTooltip label="About With friends">
            For this entry only. Friends log their own activity; tags don’t grant access. Visibility
            follows both journals’ privacy settings.
            {editing && " Changes replace all tags, including hidden ones."}
          </HelpTooltip>
        </span>
      </legend>
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
      {!full && (
        <SearchCombobox<CompanionOption>
          ariaLabel="Find a friend to tag"
          value={query}
          onChange={(text) => setQuery(text.slice(0, 100))}
          fetcher={async (text, signal) => {
            try {
              const friends = await fetcher(text, signal);
              if (!signal.aborted) setError(false);
              return friends.filter(
                (friend) => !value.some((selected) => selected.id === friend.id),
              );
            } catch (cause) {
              if (!signal.aborted) setError(true);
              throw cause;
            }
          }}
          scope={value.map((friend) => friend.id).join(",")}
          itemKey={(friend) => friend.id}
          itemText={(friend) => friend.name}
          renderItem={(friend) => friend.name}
          onSelect={(friend) => {
            setCleared(false);
            if (!disabled && !value.some((item) => item.id === friend.id))
              onChange([...value, friend]);
            setQuery("");
          }}
          placeholder="Start typing a friend's name…"
          emptyMessage={
            error
              ? "Couldn't load friends. Try typing again."
              : "No matching friends. Try a more specific name."
          }
          fullWidth
        />
      )}
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
            setError(false);
            setCleared(true);
          }}
        >
          Clear friend tags
        </Button>
      )}
      <p role="status" className="text-xs text-muted">
        {full
          ? "All 10 places filled. Remove a friend to add another."
          : `${value.length} of ${MAX_JOURNAL_COMPANIONS} friends selected.`}
        {cleared && " Friend tags will be cleared when you save."}
      </p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          Couldn't load friends. Change the search to retry; your selections are kept.
        </p>
      )}
    </fieldset>
  );
}
