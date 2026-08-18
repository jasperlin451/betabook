"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";

export function AreaSearchForm({ defaultName = "" }: { defaultName?: string }) {
  return (
    <form method="get" className="flex flex-col gap-4">
      <input type="hidden" name="mode" value="area" />
      <div className="flex flex-col gap-1">
        <label htmlFor="area-search-name" className="text-sm font-medium">
          Area name
        </label>
        <Input
          id="area-search-name"
          name="name"
          defaultValue={defaultName}
          placeholder="e.g. Squamish"
        />
      </div>
      <Button type="submit">Search Areas</Button>
    </form>
  );
}

type ClimbSearchFormProps = {
  defaultName?: string;
  defaultAreaName?: string;
  defaultDisciplines?: Array<"boulder" | "rope">;
  defaultBoulderRange?: [number, number];
  defaultRopeRange?: [number, number];
};

export function ClimbSearchForm({
  defaultName = "",
  defaultAreaName = "",
  defaultDisciplines = [],
  defaultBoulderRange = [0, BOULDER_HUECO.length - 1],
  defaultRopeRange = [0, ROPE_YDS.length - 1],
}: ClimbSearchFormProps) {
  const [showBoulder, setShowBoulder] = useState(
    defaultDisciplines.includes("boulder"),
  );
  const [showRope, setShowRope] = useState(defaultDisciplines.includes("rope"));

  return (
    <form method="get" className="flex flex-col gap-4">
      <input type="hidden" name="mode" value="climb" />

      <div className="flex flex-col gap-1">
        <label htmlFor="climb-search-name" className="text-sm font-medium">
          Climb name
        </label>
        <Input
          id="climb-search-name"
          name="name"
          defaultValue={defaultName}
          placeholder="e.g. Superfly"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="climb-search-area-name" className="text-sm font-medium">
          Area name
        </label>
        <Input
          id="climb-search-area-name"
          name="areaName"
          defaultValue={defaultAreaName}
          placeholder="e.g. Squamish (matches sub-areas too)"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            name="discipline"
            value="boulder"
            defaultChecked={showBoulder}
            onCheckedChange={(checked) => setShowBoulder(checked === true)}
          />
          <label className="text-sm font-medium">Boulder</label>
        </div>
        {showBoulder && (
          <div className="flex flex-col gap-2 pl-6">
            <span className="text-muted-foreground text-xs">
              Grade range (Hueco / V-scale)
            </span>
            <Slider
              name="boulderRange"
              min={0}
              max={BOULDER_HUECO.length - 1}
              defaultValue={defaultBoulderRange}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            name="discipline"
            value="rope"
            defaultChecked={showRope}
            onCheckedChange={(checked) => setShowRope(checked === true)}
          />
          <label className="text-sm font-medium">Rope (Sport + Trad)</label>
        </div>
        {showRope && (
          <div className="flex flex-col gap-2 pl-6">
            <span className="text-muted-foreground text-xs">
              Grade range (YDS)
            </span>
            <Slider
              name="ropeRange"
              min={0}
              max={ROPE_YDS.length - 1}
              defaultValue={defaultRopeRange}
            />
          </div>
        )}
      </div>

      <Button type="submit">Search Climbs</Button>
    </form>
  );
}
