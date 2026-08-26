import Papa from "papaparse";
import { formatGrade } from "@/lib/grades";
import type { UserSendRow } from "@/db/queries";

const EXPORT_FIELDS = [
  "Date Sent",
  "Ascent Style",
  "Climb Name",
  "Area Name",
  "Climb Type",
  "Grade",
  "Suggested Grade",
  "Grade Feel",
  "Rating",
  "Comment",
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildSendsExportCsv(rows: UserSendRow[]): string {
  const data = rows.map((row) => [
    row.dateSent ?? "",
    capitalize(row.ascentStyle),
    row.climbName,
    row.areaName,
    capitalize(row.climbType),
    formatGrade(row.climbType, row.climbGrade),
    row.suggestedGrade != null ? formatGrade(row.climbType, row.suggestedGrade) : "",
    capitalize(row.gradeFeel),
    row.rating ?? "",
    row.comment ?? "",
  ]);
  return Papa.unparse({ fields: EXPORT_FIELDS, data });
}
