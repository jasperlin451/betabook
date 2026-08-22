"use client";

import { useRouter } from "next/navigation";
import { Chip, Link, Pagination, Table } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";
import { ListRow } from "@/components/ui/list-row";

const STYLE_CHIP_COLOR: Record<ClimbType, "warning" | "accent" | "success"> = {
  boulder: "warning",
  sport: "accent",
  trad: "success",
};

type ClimbListProps = {
  climbs: (Climb & { areaName?: string })[];
  emptyMessage?: string;
  variant?: "table" | "search";
  pagination?: {
    page: number;
    hasNextPage: boolean;
    basePath: string; // e.g. `/areas/12` — page links append `?page=N`
  };
};

export function ClimbList({
  climbs,
  emptyMessage = "No climbs found.",
  variant = "table",
  pagination,
}: ClimbListProps) {
  const router = useRouter();

  if (climbs.length === 0) {
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  if (variant === "search") {
    return (
      <div className="flex flex-col divide-y divide-separator">
        {climbs.map((climb, index) => (
          <ListRow
            key={climb.id}
            href={`/climbs/${climb.id}`}
            leading={
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
            }
            title={climb.name}
            meta={formatGrade(climb.type, climb.grade)}
            subtitle={climb.areaName}
            tags={
              <Chip color={STYLE_CHIP_COLOR[climb.type]} variant="primary">
                {climb.type.toUpperCase()}
              </Chip>
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Climbs">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Type</Table.Column>
              <Table.Column>Grade</Table.Column>
            </Table.Header>
            <Table.Body>
              {climbs.map((climb) => (
                <Table.Row key={climb.id} id={climb.id}>
                  <Table.Cell>
                    <Link href={`/climbs/${climb.id}`}>{climb.name}</Link>
                  </Table.Cell>
                  <Table.Cell className="capitalize">{climb.type}</Table.Cell>
                  <Table.Cell>{formatGrade(climb.type, climb.grade)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {pagination && (pagination.page > 1 || pagination.hasNextPage) && (
        <Pagination>
          <Pagination.Content>
            {pagination.page > 1 && (
              <Pagination.Item>
                <Pagination.Previous
                  onPress={() =>
                    router.push(
                      `${pagination.basePath}?page=${pagination.page - 1}`,
                    )
                  }
                >
                  Previous
                </Pagination.Previous>
              </Pagination.Item>
            )}
            {pagination.hasNextPage && (
              <Pagination.Item>
                <Pagination.Next
                  onPress={() =>
                    router.push(
                      `${pagination.basePath}?page=${pagination.page + 1}`,
                    )
                  }
                >
                  Next
                </Pagination.Next>
              </Pagination.Item>
            )}
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
}
