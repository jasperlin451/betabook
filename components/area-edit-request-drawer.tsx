"use client";

import { Button, Drawer, Label, TextArea, TextField } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useState, useTransition } from "react";

import { requestAreaEdit } from "@/actions";
import { FIELD_CLASS } from "@/components/ui/field";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { Area } from "@/db/queries";

type AreaEditRequestDrawerProps = {
  area: Area;
  state: UseOverlayStateReturn;
};

/** A full edit (name + description) — updateArea (the description pencil)
 * only ever touches description, so a rename can only happen through here,
 * gated behind admin approval (see actions/moderation.ts's requestAreaEdit). */
export function AreaEditRequestDrawer({ area, state }: AreaEditRequestDrawerProps) {
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmedName = name.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingNotice(null);
    if (!trimmedName) return;

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("description", description);

    startTransition(async () => {
      const result = await requestAreaEdit(area.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.value.status === "pending") {
        setPendingNotice(
          "Submitted for admin review — this won't take effect until it's approved.",
        );
        return;
      }
      state.close();
    });
  }

  function handleOpenChange(isOpen: boolean) {
    state.setOpen(isOpen);
    if (!isOpen) {
      setName(area.name);
      setDescription(area.description ?? "");
      setError(null);
      setPendingNotice(null);
    }
  }

  return (
    <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={handleOpenChange}>
      <Drawer.Content>
        <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
          <Drawer.Header>
            <Drawer.Heading>Request a full edit</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextField>
                <Label>Name</Label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={FIELD_CLASS}
                />
              </TextField>

              <TextField value={description} onChange={setDescription}>
                <Label>Description</Label>
                <TextArea placeholder="Describe the area…" />
              </TextField>

              {error && <p className="text-sm text-danger">{error}</p>}
              {pendingNotice && <p className="text-sm text-muted">{pendingNotice}</p>}

              <Button type="submit" isDisabled={pending || !trimmedName} fullWidth>
                Save changes
              </Button>
            </form>
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
