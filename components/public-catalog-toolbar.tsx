"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { QueryInput } from "@/components/ui/query-input";

export function PublicCatalogToolbar({
  path,
  name,
  descending,
  subarea,
}: {
  path: string;
  name: string;
  descending: boolean;
  subarea: number | null;
}) {
  const [query, setQuery] = useState(name);
  const router = useRouter();
  function navigate(reverse: boolean) {
    const params = new URLSearchParams({ sort: reverse ? "name_desc" : "name_asc" });
    if (query) params.set("name", query);
    if (subarea) params.set("subarea", String(subarea));
    router.push(`${path}?${params}`);
  }
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(descending);
      }}
    >
      <QueryInput label="Find a climb" value={query} onChange={setQuery} />
      <Button type="submit" variant="secondary">
        Search
      </Button>
      <Button
        variant="outline"
        onPress={() => navigate(!descending)}
        aria-label={`Sort names ${descending ? "A to Z" : "Z to A"}`}
      >
        {descending ? "Z–A" : "A–Z"}
      </Button>
    </form>
  );
}
