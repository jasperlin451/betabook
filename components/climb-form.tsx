"use client";

import { useState, useTransition } from "react";
import { Button, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { createClimb, updateClimb } from "@/db/mutations";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";

type ClimbFormProps = {
  areaId: number;
  climb?: Climb;
  onDone?: () => void;
};

const CLIMB_TYPE_LABELS: Record<ClimbType, string> = {
  boulder: "Boulder",
  sport: "Sport",
  trad: "Trad",
};

export function ClimbForm({ areaId, climb, onDone }: ClimbFormProps) {
  const disciplineLocked = (climb?.sendCount ?? 0) > 0;

  const [name, setName] = useState(climb?.name ?? "");
  const [type, setType] = useState<ClimbType>(climb?.type ?? "boulder");
  const [grade, setGrade] = useState(String(climb?.grade ?? 0));
  const [description, setDescription] = useState(climb?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gradeOptions = nativeGradeArray(type);
  const trimmedName = name.trim();

  function handleTypeChange(next: ClimbType) {
    setType(next);
    setGrade("0");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("type", type);
    formData.set("grade", grade);
    formData.set("description", description);

    startTransition(async () => {
      try {
        if (climb) {
          await updateClimb(climb.id, formData);
        } else {
          await createClimb(areaId, formData);
        }
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <TextField>
        <Label>Name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        />
      </TextField>

      <TextField>
        <Label>Discipline</Label>
        <select
          value={type}
          disabled={disciplineLocked}
          onChange={(e) => handleTypeChange(e.target.value as ClimbType)}
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm disabled:opacity-60"
        >
          {Object.entries(CLIMB_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {disciplineLocked && (
          <p className="text-muted mt-1 text-xs">
            Discipline can&rsquo;t be changed once sends have been logged.
          </p>
        )}
      </TextField>

      <TextField>
        <Label>Grade</Label>
        <Select
          aria-label="Grade"
          fullWidth
          selectedKey={grade}
          onSelectionChange={(key) => setGrade(String(key))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox className="max-h-64 overflow-y-auto">
              {gradeOptions.map((label, i) => (
                <ListBox.Item key={i} id={String(i)}>
                  {label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </TextField>

      <TextField value={description} onChange={setDescription}>
        <Label>Description</Label>
        <TextArea placeholder="Describe the climb..." className="bg-surface" />
      </TextField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending || !trimmedName} fullWidth>
        {climb ? "Save Changes" : "Add Climb"}
      </Button>
    </form>
  );
}
