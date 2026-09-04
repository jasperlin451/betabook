"use client";

import { Button, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { useState, useTransition } from "react";

import { createClimb, updateClimb } from "@/actions";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { FIELD_CLASS } from "@/components/ui/field";
import type { Climb } from "@/db/queries";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";

type ClimbFormProps = {
  /** The climb's area, when already known (editing, or creating from a
   * specific area's page). `null` renders an area picker instead, for
   * creating a climb with no area yet in context. */
  areaId: number | null;
  climb?: Climb;
  /** Starting values for a new climb, carried over from a search that failed
   * to find it (see ClimbPicker's empty state) so nothing is retyped. Ignored
   * when `climb` is given — an edit starts from the climb itself. */
  initial?: { name?: string; type?: ClimbType; areaName?: string };
  onDone?: (climbId: number, climbName?: string) => void;
};

const CLIMB_TYPE_LABELS: Record<ClimbType, string> = {
  boulder: "Boulder",
  sport: "Sport",
  trad: "Trad",
};

// oxlint-disable-next-line complexity -- create/edit form with many conditionally-rendered fields
export function ClimbForm({ areaId: fixedAreaId, climb, initial, onDone }: ClimbFormProps) {
  const [name, setName] = useState(climb?.name ?? initial?.name ?? "");
  const [type, setType] = useState<ClimbType>(climb?.type ?? initial?.type ?? "boulder");
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

    if (climb) {
      const formData = new FormData();
      formData.set("description", description);
      startTransition(async () => {
        const result = await updateClimb(climb.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone?.(climb.id, climb.name);
      });
      return;
    }

    const targetAreaId = areaId;
    if (!trimmedName || targetAreaId == null) return;

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("type", type);
    formData.set("grade", grade);
    formData.set("description", description);

    startTransition(async () => {
      const result = await createClimb(targetAreaId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.(result.value, trimmedName);
    });
  }

  if (climb) {
    return (
      <form onSubmit={handleSubmit} className={SURFACE_CARD_CLASS}>
        <TextField value={description} onChange={setDescription}>
          <Label>Description</Label>
          <TextArea placeholder="Describe the climb…" />
        </TextField>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" isDisabled={pending} fullWidth>
          Save changes
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={SURFACE_CARD_CLASS}>
      {fixedAreaId == null && (
        <TextField>
          <Label>Area</Label>
          <AreaPicker
            selected={pickedArea}
            onSelectedChange={setPickedArea}
            isInvalid={areaInvalid}
            defaultQuery={initial?.areaName}
          />
          {areaInvalid && <p className="text-sm text-danger">Select an area.</p>}
        </TextField>
      )}

      <TextField>
        <Label>Name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          // data-invalid is what HeroUI's field styles key their invalid
          // ring off, so the raw input flags the same way its Inputs do.
          aria-invalid={nameInvalid}
          data-invalid={nameInvalid || undefined}
          className={FIELD_CLASS}
        />
        {nameInvalid && <p className="text-sm text-danger">Name is required.</p>}
      </TextField>

      <TextField>
        <Label>Discipline</Label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as ClimbType)}
          className={FIELD_CLASS}
        >
          {Object.entries(CLIMB_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
                // oxlint-disable-next-line react/no-array-index-key -- grade index is stable option id
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
        <TextArea placeholder="Describe the climb…" />
      </TextField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending} fullWidth>
        Add climb
      </Button>
    </form>
  );
}
