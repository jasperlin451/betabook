"use client";

import { useRouter } from "next/navigation";
import { Chip, Link, Pagination, Table } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { Climb } from "@/db/queries";

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
      <Table>
        <Table.ResizableContainer>
          <Table.Content aria-label="Climb search results">
            <Table.Header>
              <Table.Column isRowHeader defaultWidth="35%" minWidth={120}>
                Route Name
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column defaultWidth="30%" minWidth={100}>
                Area
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column defaultWidth="20%" minWidth={90}>
                Style
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column defaultWidth="15%" minWidth={80}>
                Difficulty
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {climbs.map((climb) => (
                <Table.Row key={climb.id} id={climb.id}>
                  <Table.Cell>
                    <Link href={`/climbs/${climb.id}`}>{climb.name}</Link>
                  </Table.Cell>
                  <Table.Cell>{climb.areaName}</Table.Cell>
                  <Table.Cell>
                    <Chip color={STYLE_CHIP_COLOR[climb.type]} variant="primary">
                      {climb.type.toUpperCase()}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>{formatGrade(climb.type, climb.grade)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ResizableContainer>
      </Table>
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
