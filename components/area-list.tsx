import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Area } from "@/db/queries";

type AreaListProps = {
  areas: Area[];
  emptyMessage?: string;
};

export function AreaList({
  areas,
  emptyMessage = "No areas found.",
}: AreaListProps) {
  if (areas.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {areas.map((area) => (
        <Link key={area.id} href={`/areas/${area.id}`}>
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="py-3">
              <div className="font-medium">{area.name}</div>
              {area.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {area.description}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
