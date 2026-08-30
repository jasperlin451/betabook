"use client";

import { InputGroup, Label, TextField } from "@heroui/react";
import { Search } from "lucide-react";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Visible label above the field; omit for compact placements (toolbar)
   * and supply `ariaLabel` instead. */
  label?: string;
  ariaLabel?: string;
  placeholder: string;
  className?: string;
};

/** The one search input everywhere something is searched — magnifier
 * prefix, same field styling, same placeholder voice ("Search routes…" /
 * "Search areas…") — whether it sits in a filter card or a toolbar. */
export function SearchField({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  className,
}: SearchFieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      aria-label={label ? undefined : ariaLabel}
      className={className}
    >
      {label && <Label>{label}</Label>}
      <InputGroup>
        <InputGroup.Prefix>
          <Search className="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder={placeholder} />
      </InputGroup>
    </TextField>
  );
}
