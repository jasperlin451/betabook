"use client";

import { Switch, Select, ListBox } from "@heroui/react";
import { useId } from "react";

import { SHARING_AUDIENCES, type SharingAudience } from "@/lib/privacy";

/** Controlled fields shared by Account and the local tutorial example. */
export function PrivacyFields({
  isPrivate,
  journalVisibility,
  sendCommentVisibility,
  onProfileChange,
  onJournalChange,
  onSendCommentChange,
  isPending = false,
  profileError,
  journalError,
  sendCommentError,
}: {
  isPrivate: boolean;
  journalVisibility: SharingAudience;
  sendCommentVisibility: SharingAudience;
  onProfileChange: (value: boolean) => void;
  onJournalChange: (value: SharingAudience) => void;
  onSendCommentChange: (value: SharingAudience) => void;
  isPending?: boolean;
  profileError?: string | null;
  journalError?: string | null;
  sendCommentError?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Switch isDisabled={isPending} isSelected={isPrivate} onChange={onProfileChange}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Private profile
          </Switch.Content>
        </Switch>
        <p className="text-xs text-muted">
          {isPrivate
            ? "Only you can see your profile and climbing history. Friends and request recipients can still see your name. Your saved audiences will apply when your profile is public."
            : "Everyone can see your profile and send details: climbs, dates, ascent styles, ratings, and grades. Choose who can read your commentary and journal below."}
        </p>
        {profileError && (
          <p role="alert" className="text-sm text-danger">
            {profileError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-5 border-t border-separator pt-4">
        <AudienceField
          label="Send commentary"
          description="Notes on original sends, including the matching ascent note in your journal."
          value={isPrivate ? "private" : sendCommentVisibility}
          onChange={onSendCommentChange}
          disabled={isPrivate || isPending}
          error={sendCommentError}
        />
        <AudienceField
          label="Journal entries"
          description="Sessions, repeats, training, and journal tags. Commentary on original sends uses the setting above."
          value={isPrivate ? "private" : journalVisibility}
          onChange={onJournalChange}
          disabled={isPrivate || isPending}
          error={journalError}
        />
      </div>
      <p className="text-xs text-muted">
        {!isPrivate &&
          "Friends means an accepted friend request. Audiences apply to past and future entries. "}
        Your sends still count toward community ratings.
      </p>
    </div>
  );
}

function AudienceField({
  label,
  description,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  description: string;
  value: SharingAudience;
  onChange: (value: SharingAudience) => void;
  disabled: boolean;
  error?: string | null;
}) {
  const descriptionId = useId();
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">{label}</p>
      <Select
        aria-label={`${label} audience`}
        aria-describedby={descriptionId}
        selectedKey={value}
        isDisabled={disabled}
        onSelectionChange={(key) => {
          const audience = SHARING_AUDIENCES.find((option) => option.value === key);
          if (audience) onChange(audience.value);
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SHARING_AUDIENCES.map(({ value, label }) => (
              <ListBox.Item key={value} id={value} textValue={label}>
                {label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <p id={descriptionId} className="text-xs text-muted">
        {description}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
