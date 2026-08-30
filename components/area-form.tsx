"use client";

import { useState, useTransition } from "react";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
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
};

export function AreaForm({ parentId: fixedParentId, area, onDone }: AreaFormProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
  const [pickedParent, setPickedParent] = useState<PickedArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parentId = fixedParentId ?? pickedParent?.id ?? null;
  const trimmedName = name.trim();

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
        <TextField>
          <Label>Parent area</Label>
          <AreaPicker selected={pickedParent} onSelectedChange={setPickedParent} />
        </TextField>
      )}

      <TextField>
        <Label>Name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
        />
      </TextField>

      <TextField value={description} onChange={setDescription}>
        <Label>Description</Label>
        <TextArea placeholder="Describe the area..." className="bg-surface" />
      </TextField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending || !trimmedName} fullWidth>
        {area ? "Save Changes" : "Add Area"}
      </Button>
    </form>
  );
}
