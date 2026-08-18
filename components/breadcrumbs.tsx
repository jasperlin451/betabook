import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
type BreadcrumbNamed = { id: number; name: string };

type AreaBreadcrumbsProps = {
  ancestors: BreadcrumbNamed[];
  current: BreadcrumbNamed;
};

export function AreaBreadcrumbs({ ancestors, current }: AreaBreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="contents">
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/areas/${ancestor.id}`} />}>
                {ancestor.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </span>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage>{current.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
