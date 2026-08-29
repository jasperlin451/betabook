"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
import { FormError } from "@/components/ui/form-error";
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
  /** Reports whether the form currently differs from its seeded values —
   * lets the wrapping drawer confirm before discarding unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
};

const CLIMB_TYPE_LABELS: Record<ClimbType, string> = {
  boulder: "Boulder",
  sport: "Sport",
  trad: "Trad",
};

export function ClimbForm({ areaId: fixedAreaId, climb, onDone, onDirtyChange }: ClimbFormProps) {
  const disciplineLocked = (climb?.sendCount ?? 0) > 0;

  const nameErrorId = useId();
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

  // Current values vs the seeds above — mirrors the useState initializers.
  const isDirty =
    name !== (climb?.name ?? "") ||
    type !== (climb?.type ?? "boulder") ||
    grade !== String(climb?.grade ?? 0) ||
    description !== (climb?.description ?? "") ||
    pickedArea != null;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      {fixedAreaId == null && (
        <AreaPicker
          label="Area"
          selected={pickedArea}
          onSelectedChange={setPickedArea}
          isInvalid={areaInvalid}
          errorMessage={areaInvalid ? "Select an area." : null}
        />
      )}

      <TextField
        value={name}
        onChange={setName}
        isInvalid={nameInvalid}
        aria-describedby={nameInvalid ? nameErrorId : undefined}
      >
        <Label>Name</Label>
        <Input className="bg-surface" />
        <FormError id={nameErrorId}>{nameInvalid ? "Name is required." : null}</FormError>
      </TextField>

      <Select
        fullWidth
        selectedKey={type}
        onSelectionChange={(key) => handleTypeChange(String(key) as ClimbType)}
        isDisabled={disciplineLocked}
      >
        <Label>Discipline</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(CLIMB_TYPE_LABELS).map(([value, label]) => (
              <ListBox.Item key={value} id={value}>
                {label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {disciplineLocked && (
          <Description>
            Discipline can&rsquo;t be changed once sends have been logged.
          </Description>
        )}
      </Select>

      <Select
        fullWidth
        selectedKey={grade}
        onSelectionChange={(key) => setGrade(String(key))}
      >
        <Label>Grade</Label>
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

      <TextField value={description} onChange={setDescription}>
        <Label>Description</Label>
        <TextArea placeholder="Describe the climb..." className="bg-surface" />
      </TextField>

      <FormError>{error}</FormError>

      <Button type="submit" isDisabled={pending} fullWidth>
        {pending ? "Saving..." : climb ? "Save Changes" : "Add Climb"}
      </Button>
    </form>
  );
}
