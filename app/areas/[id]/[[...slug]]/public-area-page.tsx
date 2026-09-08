import { AuthCallout } from "@/components/auth-callout";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { PublicCatalogToolbar } from "@/components/public-catalog-toolbar";
import { PublicClimbList } from "@/components/public-climb-list";
import { RegisterSearchScope } from "@/components/search-scope";
import { SubareaRail } from "@/components/subarea-rail";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { JsonLd } from "@/components/ui/json-ld";
import { SidebarLayout } from "@/components/ui/page-shell";
import { PageTitle, SectionHeading } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import {
  getPublicAncestors,
  getPublicSubareas,
  resolvePublicSubarea,
  searchPublicClimbs,
} from "@/db/queries/public-catalog";
import { parseId } from "@/lib/parse-id";
import { publicCatalogOptions, type PublicArea } from "@/lib/public-catalog";
import { areaDescription, areaJsonLd, locationTrail } from "@/lib/seo";
import { areaHref, withQuery } from "@/lib/slug";
import { toArray, type UrlParamsRecord } from "@/lib/url-params";

export async function PublicAreaPage({
  area,
  search,
}: {
  area: PublicArea;
  search: UrlParamsRecord;
}) {
  const db = await getDb();
  const path = areaHref(area.id, area.name);
  const subarea = parseId(toArray(search.subarea)[0] ?? "");
  const params = new URLSearchParams({
    name: toArray(search.name)[0] ?? "",
    sort: toArray(search.sort)[0] === "name_desc" ? "name_desc" : "name_asc",
  });
  if (subarea) params.set("subarea", String(subarea));
  const options = publicCatalogOptions(params);
  const scope = await resolvePublicSubarea(db, area, subarea);
  const [ancestors, subareas, initial] = await Promise.all([
    getPublicAncestors(db, area),
    getPublicSubareas(db, area.id),
    searchPublicClimbs(db, { ...options, areaId: scope.id }),
  ]);
  const ancestorNames = ancestors.map((a) => a.name);
  const climbsBlock = (
    <div className="flex flex-col gap-3">
      <SectionHeading>Climbs</SectionHeading>
      <PublicCatalogToolbar
        key={`toolbar:${params}`}
        path={path}
        name={options.name}
        descending={options.descending}
        subarea={subarea}
      />
      <PublicClimbList
        key={`climbs:${params}`}
        initial={initial}
        areaId={area.id}
        query={params.toString()}
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={areaJsonLd({
          name: area.name,
          path,
          description: areaDescription(area.name, locationTrail(ancestorNames)),
          ancestorNames,
          crumbs: [
            { name: "Home", path: "/" },
            ...ancestors.map((a) => ({ name: a.name, path: areaHref(a.id, a.name) })),
            { name: area.name, path },
          ],
        })}
      />
      <RegisterSearchScope areaId={area.id} areaName={area.name} />
      <AreaBreadcrumbs ancestors={ancestors} current={area} />
      <PageTitle>{area.name}</PageTitle>
      <AuthCallout
        next={withQuery(path, search)}
        description="Sign in to read area descriptions and explore climb grades, ratings, and activity."
      />
      {subareas.length ? (
        <SidebarLayout
          sidebarWidthClass="lg:w-64"
          sidebar={
            <CollapsibleSection title="Sub-areas" breakpoint="lg">
              <SubareaRail subareas={subareas} />
            </CollapsibleSection>
          }
        >
          {climbsBlock}
        </SidebarLayout>
      ) : (
        climbsBlock
      )}
    </div>
  );
}
