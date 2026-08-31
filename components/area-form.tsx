"use client";

import { useState, useTransition } from "react";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { AreaPicker, type PickedArea } from "@/components/area-picker";
import { createArea, updateArea } from "@/db/mutations";
import type { Area } from "@/db/queries";

type AreaFormProps = {
  /** The new area's parent, when already fixed (creating a subarea from an
   * existing area's menu — no picker shown). `null` renders an `AreaPicker`
   * instead, which the viewer has to pick from: every area added here goes
   * under an existing one. Root areas exist (the seed data's continents) but
   * aren't creatable from this form, so an empty picker is an error rather
   * than a request for one. Ignored when editing (`area` present) — an
   * area's parent isn't editable here. */
  parentId: number | null;
  area?: Area;
  onDone?: (areaId: number) => void;
};

export function AreaForm({ parentId: fixedParentId, area, onDone }: AreaFormProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
  const [pickedParent, setPickedParent] = useState<PickedArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pending, startTransition] = useTransition();

  const parentId = fixedParentId ?? pickedParent?.id ?? null;
  const trimmedName = name.trim();
  // Only when the picker is the one supplying the parent: a fixed parent is
  // always set, and editing doesn't touch the parent at all.
  const parentInvalid = submitAttempted && !area && parentId == null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitAttempted(true);

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("description", description);

    if (area) {
      startTransition(async () => {
        const result = await updateArea(area.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone?.(area.id);
      });
      return;
    }

    // A new area always goes under an existing one; `parentInvalid` is
    // already showing why nothing happened.
    if (parentId == null) return;

    startTransition(async () => {
      const result = await createArea(parentId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.(result.value);
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
          <AreaPicker
            selected={pickedParent}
            onSelectedChange={setPickedParent}
            isInvalid={parentInvalid}
          />
          {parentInvalid && <p className="text-sm text-danger">Select a parent area.</p>}
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
