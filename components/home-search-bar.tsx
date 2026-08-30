"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { SearchField } from "@/components/ui/search-field";

/** The feed's one search entry point. Deliberately submit-on-Enter rather
 * than debounced: searching swaps the page into the full results view, and
 * a debounce would yank the input out from under someone mid-word. The
 * results view's own filter card takes over from there (prefilled, live). */
export function HomeSearchBar() {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <form
      className="flex w-full items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const query = name.trim();
        const params = new URLSearchParams({ mode: "climb" });
        if (query) params.set("name", query);
        router.push(`/?${params.toString()}`);
      }}
    >
      <SearchField
        value={name}
        onChange={setName}
        ariaLabel="Search routes"
        placeholder="Search routes…"
        className="min-w-0 flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
