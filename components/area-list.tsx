import { Card, Link } from "@heroui/react";
import type { Area } from "@/db/queries";

type AreaListProps = {
  areas: (Area & { ancestorPath?: string | null })[];
  emptyMessage?: string;
  variant?: "card" | "link";
};

export function AreaList({
  areas,
  emptyMessage = "No areas found.",
  variant = "card",
}: AreaListProps) {
  if (areas.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  if (variant === "link") {
    return (
      <div className="flex flex-col gap-3">
        {areas.map((area) => (
          <div key={area.id}>
            <Link href={`/areas/${area.id}`}>{area.name}</Link>
            {area.ancestorPath && (
              <p className="text-muted text-sm">Parent: {area.ancestorPath}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {areas.map((area) => (
        <Link
          key={area.id}
          href={`/areas/${area.id}`}
          className="text-foreground no-underline"
        >
          <Card className="transition-colors hover:bg-surface-hover">
            <Card.Content className="py-3">
              <div className="font-medium">{area.name}</div>
              {area.description && (
                <p className="text-muted line-clamp-2 text-sm">
                  {area.description}
                </p>
              )}
            </Card.Content>
          </Card>
        </Link>
      ))}
    </div>
  );
}
