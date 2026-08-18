import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatGrade } from "@/lib/grades";
import type { Climb } from "@/db/queries";

type ClimbListProps = {
  climbs: Climb[];
  emptyMessage?: string;
  pagination?: {
    page: number;
    hasNextPage: boolean;
    basePath: string; // e.g. `/areas/12` — page links append `?page=N`
  };
};

export function ClimbList({
  climbs,
  emptyMessage = "No climbs found.",
  pagination,
}: ClimbListProps) {
  if (climbs.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {climbs.map((climb) => (
            <TableRow key={climb.id}>
              <TableCell>
                <Link
                  href={`/climbs/${climb.id}`}
                  className="hover:underline"
                >
                  {climb.name}
                </Link>
              </TableCell>
              <TableCell className="capitalize">{climb.type}</TableCell>
              <TableCell>{formatGrade(climb.type, climb.grade)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && (pagination.page > 1 || pagination.hasNextPage) && (
        <Pagination>
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href={`${pagination.basePath}?page=${pagination.page - 1}`}
                />
              </PaginationItem>
            )}
            {pagination.hasNextPage && (
              <PaginationItem>
                <PaginationNext
                  href={`${pagination.basePath}?page=${pagination.page + 1}`}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
