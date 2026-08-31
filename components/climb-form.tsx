"use client";

import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import { useState, useTransition } from "react";
import { Button, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
import { createClimb, updateClimb } from "@/db/mutations";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";

type ClimbFormProps = {
  /** The climb's area, when already known (editing, or creating from a
   * specific area's page). `null` renders an area picker instead, for
   * creating a climb with no area yet in context. */
  areaId: number | null;
  climb?: Climb;
  onDone?: (climbId: number) => void;
};

const CLIMB_TYPE_LABELS: Record<ClimbType, string> = {
  boulder: "Boulder",
  sport: "Sport",
  trad: "Trad",
};

export function ClimbForm({ areaId: fixedAreaId, climb, onDone }: ClimbFormProps) {
  const disciplineLocked = (climb?.sendCount ?? 0) > 0;

  const [name, setName] = useState(climb?.name ?? "");
  const [type, setType] = useState<ClimbType>(climb?.type ?? "boulder");
  const [grade, setGrade] = useState(String(climb?.grade ?? 0));
  const [description, setDescription] = useState(climb?.description ?? "");
  const [pickedArea, setPickedArea] = useState<PickedArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pending, startTransition] = useTransition();

  const areaId = fixedAreaId ?? pickedArea?.id ?? null;
  const gradeOptions = nativeGradeArray(type);
  const trimmedName = name.trim();
  const nameInvalid = submitAttempted && !trimmedName;
  const areaInvalid = submitAttempted && !climb && areaId == null;

  function handleTypeChange(next: ClimbType) {
    setType(next);
    setGrade("0");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitAttempted(true);

    if (!trimmedName || (!climb && areaId == null)) return;

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("type", type);
    formData.set("grade", grade);
    formData.set("description", description);

    startTransition(async () => {
      if (climb) {
        const result = await updateClimb(climb.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone?.(climb.id);
      } else {
        const result = await createClimb(areaId as number, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone?.(result.value);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={SURFACE_CARD_CLASS}
    >
      {fixedAreaId == null && (
        <TextField>
          <Label>Area</Label>
          <AreaPicker
            selected={pickedArea}
            onSelectedChange={setPickedArea}
            isInvalid={areaInvalid}
          />
          {areaInvalid && <p className="text-sm text-danger">Select an area.</p>}
        </TextField>
      )}

      <TextField>
        <Label>Name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={nameInvalid}
          className={`${FIELD_CLASS} aria-invalid:border-danger`}
        />
        {nameInvalid && <p className="text-sm text-danger">Name is required.</p>}
      </TextField>

      <TextField>
        <Label>Discipline</Label>
        <select
          value={type}
          disabled={disciplineLocked}
          onChange={(e) => handleTypeChange(e.target.value as ClimbType)}
          className={`${FIELD_CLASS} disabled:opacity-60`}
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

      <Button type="submit" isDisabled={pending} fullWidth>
        {climb ? "Save Changes" : "Add Climb"}
      </Button>
    </form>
  );
}
