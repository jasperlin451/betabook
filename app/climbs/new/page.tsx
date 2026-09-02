import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewClimbForm } from "@/components/new-climb-form";
import { PageTitle } from "@/components/ui/typography";
import { isClimbType } from "@/lib/climbs";
import { toArray, type SearchParamsRecord } from "@/lib/search-params";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Add climb",
  robots: { index: false },
};

type NewClimbPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

/** `name`, `areaName`, and `type` seed the form — the route search that came
 * up empty hands them over so a climb that isn't in the book yet can be added
 * without retyping what was just searched for (see ClimbPicker's empty
 * state). All three are optional, and an unrecognized `type` is dropped
 * rather than rejected: these are conveniences, not input to validate. */
export default async function NewClimbPage({ searchParams }: NewClimbPageProps) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  const initial = {
    name: toArray(params.name)[0],
    areaName: toArray(params.areaName)[0],
    type: toArray(params.type).find(isClimbType),
  };

  if (!session) {
    // Carry the seeds through the round trip, so signing in comes back to the
    // form already filled rather than an empty one.
    const search = new URLSearchParams();
    if (initial.name) search.set("name", initial.name);
    if (initial.areaName) search.set("areaName", initial.areaName);
    if (initial.type) search.set("type", initial.type);
    const query = search.toString();
    redirect(signInUrl(`/climbs/new${query ? `?${query}` : ""}`));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Add climb</PageTitle>
      <NewClimbForm initial={initial} />
    </div>
  );
}
