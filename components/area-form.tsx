"use client";

import { useState, useTransition } from "react";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { updateArea } from "@/db/mutations";
import type { Area } from "@/db/queries";

type AreaFormProps = {
  area: Area;
  onDone?: () => void;
};

export function AreaForm({ area, onDone }: AreaFormProps) {
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmedName = name.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("description", description);

    startTransition(async () => {
      try {
        await updateArea(area.id, formData);
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

      <TextField value={description} onChange={setDescription}>
        <Label>Description</Label>
        <TextArea placeholder="Describe the area..." className="bg-surface" />
      </TextField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" isDisabled={pending || !trimmedName} fullWidth>
        Save Changes
      </Button>
    </form>
  );
}
