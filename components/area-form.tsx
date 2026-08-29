"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
import { FormError } from "@/components/ui/form-error";
import { createArea, updateArea } from "@/db/mutations";
import type { Area } from "@/db/queries";

type AreaFormProps = {
  /** The new area's parent, when already fixed (creating a subarea from an
   * existing area's menu — no picker shown). `null` renders an `AreaPicker`
   * instead, letting the viewer optionally choose a parent; leaving it
   * unset creates a root area (same as the seed data's continents, which
   * have no parent). Ignored when editing (`area` present) — an area's
   * parent isn't editable here. */
  parentId: number | null;
  area?: Area;
  onDone?: (areaId: number) => void;
  /** Reports whether the form currently differs from its seeded values —
   * lets the wrapping drawer confirm before discarding unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
};

export function AreaForm({ parentId: fixedParentId, area, onDone, onDirtyChange }: AreaFormProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
  const [pickedParent, setPickedParent] = useState<PickedArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parentId = fixedParentId ?? pickedParent?.id ?? null;
  const trimmedName = name.trim();

  // Current values vs the seeds above — mirrors the useState initializers.
  const isDirty =
    name !== (area?.name ?? "") ||
    description !== (area?.description ?? "") ||
    pickedParent != null;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("description", description);

    startTransition(async () => {
      if (area) {
        const result = await updateArea(area.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone?.(area.id);
      } else {
        const result = await createArea(parentId, formData);
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
      {!area && fixedParentId == null && (
        <AreaPicker
          label="Parent area"
          selected={pickedParent}
          onSelectedChange={setPickedParent}
        />
      )}

      <TextField value={name} onChange={setName} isRequired>
        <Label>Name</Label>
        <Input className="bg-surface" />
      </TextField>

      <TextField value={description} onChange={setDescription}>
        <Label>Description</Label>
        <TextArea placeholder="Describe the area..." className="bg-surface" />
      </TextField>

      <FormError>{error}</FormError>

      <Button type="submit" isDisabled={pending || !trimmedName} fullWidth>
        {pending ? "Saving..." : area ? "Save Changes" : "Add Area"}
      </Button>
    </form>
  );
}
