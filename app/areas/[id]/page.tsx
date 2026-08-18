import { notFound } from "next/navigation";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { AreaList } from "@/components/area-list";
import { ClimbList } from "@/components/climb-list";
import { getAncestors, getArea, getSubareas, getSubtreeClimbs } from "@/db/queries";

type AreaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function AreaPage({ params, searchParams }: AreaPageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const areaId = Number(id);

  if (!Number.isInteger(areaId)) notFound();

  const area = await getArea(areaId);
  if (!area) notFound();

  const page = Math.max(1, Number(pageParam) || 1);

  const [ancestors, subareas, subtreeClimbs] = await Promise.all([
    getAncestors(area),
    getSubareas(area.id),
    getSubtreeClimbs(area, page),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={ancestors} current={area} />

      <div>
        <h1 className="text-2xl font-semibold">{area.name}</h1>
        {area.description && (
          <p className="text-muted-foreground mt-1">{area.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Sub-areas</h2>
        <AreaList areas={subareas} emptyMessage="No sub-areas." />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Climbs</h2>
        <ClimbList
          climbs={subtreeClimbs.climbs}
          emptyMessage="No climbs found in this area or its sub-areas."
          pagination={{
            page: subtreeClimbs.page,
            hasNextPage: subtreeClimbs.hasNextPage,
            basePath: `/areas/${area.id}`,
          }}
        />
      </section>
    </div>
  );
}
