"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Label, TextField } from "@heroui/react";
import { importSends, type ImportResult } from "@/db/mutations";
import { ASCENT_STYLES, type AscentStyle } from "@/lib/sends";
import {
  buildFailedRowsCsv,
  distinctValues,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessColumnMapping,
  normalizeImportRows,
  parseCsvText,
  detectDateFormat,
  CLIMB_TYPES,
  IMPORT_BATCH_SIZE,
  type AscentStyleMapping,
  type ClimbTypeMapping,
  type ColumnMapping,
  type DateFormat,
  type InvalidImportRow,
  type NormalizedImportRow,
  type ParsedCsv,
} from "@/lib/sends-import";

type Step = "upload" | "columns" | "values" | "review" | "result";

const COLUMN_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date", label: "Date Sent", required: false },
  { key: "ascentStyle", label: "Ascent Style", required: true },
  { key: "climbName", label: "Climb Name", required: true },
  { key: "areaName", label: "Area Name", required: true },
  { key: "climbType", label: "Climb Type (tiebreaker only)", required: false },
  { key: "grade", label: "Grade", required: false },
  { key: "gradeFeel", label: "Grade Feel", required: false },
  { key: "rating", label: "Rating", required: false },
  { key: "comment", label: "Comment", required: false },
];

type ImportProgress = {
  completed: number;
  total: number;
  imported: number;
  alreadyLogged: number;
  notFound: number;
  failed: number; // rows from a batch that errored out entirely
};

type BatchError = { rows: NormalizedImportRow[]; message: string };
type WizardResult = ImportResult & { batchErrors: BatchError[] };

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [ascentStyleMapping, setAscentStyleMapping] =
    useState<AscentStyleMapping>({});
  const [climbTypeMapping, setClimbTypeMapping] = useState<ClimbTypeMapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>("iso");
  const [gradeScale, setGradeScale] = useState<"native" | "converted">("native");

  const [normalized, setNormalized] = useState<{
    valid: NormalizedImportRow[];
    invalid: InvalidImportRow[];
  } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<WizardResult | null>(null);

  const ascentStyleValues = useMemo(
    () => (parsedCsv && columnMapping ? distinctValues(parsedCsv.rows, columnMapping.ascentStyle) : []),
    [parsedCsv, columnMapping],
  );
  const climbTypeValues = useMemo(
    () => (parsedCsv && columnMapping ? distinctValues(parsedCsv.rows, columnMapping.climbType) : []),
    [parsedCsv, columnMapping],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError("Couldn't find any data rows in that file.");
      return;
    }

    const mapping = guessColumnMapping(parsed.headers);
    setParsedCsv(parsed);
    setColumnMapping(mapping);
    setStep("columns");
  }

  function handleColumnsNext() {
    if (!parsedCsv || !columnMapping) return;
    const ascentStyleValues = distinctValues(parsedCsv.rows, columnMapping.ascentStyle);
    const climbValues = distinctValues(parsedCsv.rows, columnMapping.climbType);
    setAscentStyleMapping(guessAscentStyleMapping(ascentStyleValues));
    setClimbTypeMapping(guessClimbTypeMapping(climbValues));
    if (columnMapping.date) {
      const sample = distinctValues(parsedCsv.rows, columnMapping.date).slice(0, 25);
      setDateFormat(detectDateFormat(sample));
    }
    setStep("values");
  }

  function handleValuesNext() {
    if (!parsedCsv || !columnMapping) return;
    const result = normalizeImportRows(
      parsedCsv,
      columnMapping,
      ascentStyleMapping,
      climbTypeMapping,
      dateFormat,
    );
    setNormalized(result);
    setStep("review");
  }

  function handleFinalize() {
    if (!normalized) return;
    setError(null);
    const total = normalized.valid.length;
    setProgress({ completed: 0, total, imported: 0, alreadyLogged: 0, notFound: 0, failed: 0 });

    startTransition(async () => {
      let imported = 0;
      let alreadyLogged = 0;
      const notFound: ImportResult["notFound"] = [];
      const batchErrors: BatchError[] = [];

      for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
        const batch = normalized.valid.slice(i, i + IMPORT_BATCH_SIZE);
        try {
          const result = await importSends(batch, gradeScale);
          imported += result.imported;
          alreadyLogged += result.alreadyLogged;
          notFound.push(...result.notFound);
        } catch (err) {
          batchErrors.push({
            rows: batch,
            message: err instanceof Error ? err.message : "Import failed",
          });
        }
        setProgress({
          completed: Math.min(i + IMPORT_BATCH_SIZE, total),
          total,
          imported,
          alreadyLogged,
          notFound: notFound.length,
          failed: batchErrors.reduce((n, b) => n + b.rows.length, 0),
        });
      }

      setImportResult({ imported, alreadyLogged, notFound, batchErrors });
      setStep("result");
    });
  }

  function handleDownloadFailedRows() {
    if (!importResult || !normalized || !parsedCsv) return;
    const csvText = buildFailedRowsCsv(
      parsedCsv.headers,
      normalized.invalid,
      importResult.notFound,
      importResult.batchErrors,
    );
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "failed-sends-import.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("upload");
    setParsedCsv(null);
    setColumnMapping(null);
    setAscentStyleMapping({});
    setClimbTypeMapping({});
    setDateFormat("iso");
    setGradeScale("native");
    setNormalized(null);
    setProgress(null);
    setImportResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-surface-secondary p-6">
      <h1 className="text-lg font-semibold">Import Sends from CSV</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Upload a CSV export of your climbing log. You&apos;ll be able to map its columns
            and clarify a few ambiguous values before anything is imported.
          </p>
          <input type="file" accept=".csv" onChange={handleFileChange} />
        </div>
      )}

      {step === "columns" && columnMapping && parsedCsv && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Which column in your CSV holds each field? ({parsedCsv.rows.length} rows found)
          </p>
          {COLUMN_FIELDS.map(({ key, label, required }) => (
            <TextField key={key}>
              <Label>
                {label}
                {required ? " (required)" : ""}
              </Label>
              <select
                value={columnMapping[key] ?? ""}
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, [key]: e.target.value || null })
                }
                className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {parsedCsv.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </TextField>
          ))}
          <Button onPress={handleColumnsNext}>Next: Value Mapping</Button>
        </div>
      )}

      {step === "values" && (
        <div className="flex flex-col gap-6">
          {ascentStyleValues.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Ascent Style Values</p>
              {ascentStyleValues.map((value) => (
                <div key={value} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 truncate text-sm">{value}</span>
                  <select
                    value={ascentStyleMapping[value] ?? "skip"}
                    onChange={(e) =>
                      setAscentStyleMapping({
                        ...ascentStyleMapping,
                        [value]: e.target.value as AscentStyle | "skip",
                      })
                    }
                    className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
                  >
                    {ASCENT_STYLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="skip">Skip these rows</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {climbTypeValues.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Climb Type Values (used only to break ties for ambiguous matches)
              </p>
              {climbTypeValues.map((value) => (
                <div key={value} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 truncate text-sm">{value}</span>
                  <select
                    value={climbTypeMapping[value] ?? "skip"}
                    onChange={(e) =>
                      setClimbTypeMapping({
                        ...climbTypeMapping,
                        [value]: e.target.value as (typeof CLIMB_TYPES)[number] | "skip",
                      })
                    }
                    className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
                  >
                    {CLIMB_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="skip">Ignore</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {columnMapping?.date && (
            <TextField>
              <Label>Date Format</Label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
              >
                <option value="iso">YYYY-MM-DD</option>
                <option value="mdy">MM/DD/YYYY</option>
                <option value="dmy">DD/MM/YYYY</option>
              </select>
            </TextField>
          )}

          {columnMapping?.grade && (
            <TextField>
              <Label>Grade Notation</Label>
              <select
                value={gradeScale}
                onChange={(e) => setGradeScale(e.target.value as "native" | "converted")}
                className="rounded-md border border-separator bg-surface px-3 py-2 text-sm"
              >
                <option value="native">Native (V-scale / YDS)</option>
                <option value="converted">Converted (Font / French)</option>
              </select>
            </TextField>
          )}

          <div className="flex gap-4">
            <Button variant="ghost" onPress={() => setStep("columns")}>
              Back
            </Button>
            <Button onPress={handleValuesNext}>Next: Review</Button>
          </div>
        </div>
      )}

      {step === "review" && normalized && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            <strong>{normalized.valid.length}</strong> rows ready to import.{" "}
            {normalized.invalid.length > 0 && (
              <strong>{normalized.invalid.length}</strong>
            )}
            {normalized.invalid.length > 0 && " rows can't be imported."}
          </p>

          {normalized.invalid.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted">
                View rows that can&apos;t be imported
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                {normalized.invalid.map((row, i) => (
                  <li key={i}>
                    Row {row.rowIndex + 1}: {row.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {pending && progress ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                Importing… {progress.completed} / {progress.total} rows processed
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted">
                {progress.imported} imported &middot; {progress.alreadyLogged} already logged
                &middot; {progress.notFound} not found &middot; {progress.failed} failed
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              <Button variant="ghost" onPress={() => setStep("values")}>
                Back
              </Button>
              <Button onPress={handleFinalize} isDisabled={normalized.valid.length === 0}>
                Finalize Import
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "result" && importResult && normalized && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Imported <strong>{importResult.imported}</strong>, already logged{" "}
            <strong>{importResult.alreadyLogged}</strong>, couldn&apos;t import{" "}
            <strong>{importResult.notFound.length + normalized.invalid.length}</strong>
            {importResult.batchErrors.length > 0 && (
              <>
                , and{" "}
                <strong>
                  {importResult.batchErrors.reduce((n, b) => n + b.rows.length, 0)}
                </strong>{" "}
                couldn&apos;t be attempted due to an error
              </>
            )}
            .
          </p>

          {(importResult.notFound.length > 0 ||
            normalized.invalid.length > 0 ||
            importResult.batchErrors.length > 0) && (
            <details>
              <summary className="cursor-pointer text-sm text-muted">
                View rows that couldn&apos;t be imported
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                {importResult.notFound.map((row, i) => (
                  <li key={`nf-${i}`}>
                    {row.climbName} ({row.areaName}):{" "}
                    {row.reason === "climb-not-found" ? "climb not found" : "ambiguous match"}
                  </li>
                ))}
                {normalized.invalid.map((row, i) => (
                  <li key={`inv-${i}`}>
                    Row {row.rowIndex + 1}: {row.reason}
                  </li>
                ))}
                {importResult.batchErrors.map((batch, i) =>
                  batch.rows.map((row, j) => (
                    <li key={`err-${i}-${j}`}>
                      {row.climbName} ({row.areaName}): not attempted — {batch.message}
                    </li>
                  )),
                )}
              </ul>
            </details>
          )}

          <div className="flex gap-4">
            {(importResult.notFound.length > 0 ||
              normalized.invalid.length > 0 ||
              importResult.batchErrors.length > 0) && (
              <Button variant="ghost" onPress={handleDownloadFailedRows}>
                Download Failed Rows (CSV)
              </Button>
            )}
            <Button onPress={reset}>Import Another File</Button>
          </div>
        </div>
      )}
    </div>
  );
}
