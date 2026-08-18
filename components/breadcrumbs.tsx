import { Breadcrumbs } from "@heroui/react";

type BreadcrumbNamed = { id: number; name: string };

type AreaBreadcrumbsProps = {
  ancestors: BreadcrumbNamed[];
  current: BreadcrumbNamed;
};

export function AreaBreadcrumbs({ ancestors, current }: AreaBreadcrumbsProps) {
  return (
    <Breadcrumbs>
      {ancestors.map((ancestor) => (
        <Breadcrumbs.Item key={ancestor.id} href={`/areas/${ancestor.id}`}>
          {ancestor.name}
        </Breadcrumbs.Item>
      ))}
      <Breadcrumbs.Item>{current.name}</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
