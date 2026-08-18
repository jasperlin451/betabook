import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { getAncestors, getArea } from "@/db/queries";
import { formatGrade } from "@/lib/grades";
import { getDb } from "@/db/client";
import { climbs } from "@/db/schema";
import { eq } from "drizzle-orm";

type ClimbPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClimbPage({ params }: ClimbPageProps) {
  const { id } = await params;
  const climbId = Number(id);

  if (!Number.isInteger(climbId)) notFound();

  const db = await getDb();
  const climb = await db
    .select()
    .from(climbs)
    .where(eq(climbs.id, climbId))
    .get();

  if (!climb) notFound();

  const area = await getArea(climb.areaId);
  if (!area) notFound();

  const ancestors = await getAncestors(area);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={[...ancestors, area]} current={climb} />

      <div>
        <h1 className="text-2xl font-semibold">{climb.name}</h1>
        <p className="text-muted-foreground mt-1 capitalize">
          {climb.type} &middot; {formatGrade(climb.type, climb.grade)}
        </p>
      </div>

      {/* Ticks are post-MVP — this is the natural spot for a future
          "log a tick" / community ticks section. */}
    </div>
  );
}
