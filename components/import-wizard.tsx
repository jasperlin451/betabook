"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import { FormError } from "@/components/ui/form-error";
import { announce } from "@/components/ui/status-announcer";
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

/** Sentinel key for "this field has no CSV column" — react-aria Select keys
 * must be non-null to be selectable, so `null` in the mapping round-trips
 * through this. */
const NO_COLUMN = "__none__";

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

  const fileInputId = useId();
  const ascentValuesHeadingId = useId();
  const climbTypeValuesHeadingId = useId();

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
        const result = await importSends(batch, gradeScale);
        if (result.ok) {
          imported += result.value.imported;
          alreadyLogged += result.value.alreadyLogged;
          notFound.push(...result.value.notFound);
        } else {
          batchErrors.push({ rows: batch, message: result.error });
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
      const failed =
        notFound.length + batchErrors.reduce((n, b) => n + b.rows.length, 0);
      announce(
        `Import finished: ${imported} imported, ${alreadyLogged} already logged, ${failed} not imported.`,
      );
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

      <FormError>{error}</FormError>

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Upload a CSV export of your climbing log. You&apos;ll be able to map its columns
            and clarify a few ambiguous values before anything is imported.
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor={fileInputId}>CSV file</Label>
            <input id={fileInputId} type="file" accept=".csv" onChange={handleFileChange} />
          </div>
        </div>
      )}

      {step === "columns" && columnMapping && parsedCsv && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Which column in your CSV holds each field? ({parsedCsv.rows.length} rows found)
          </p>
          {COLUMN_FIELDS.map(({ key, label, required }) => (
            <Select
              key={key}
              fullWidth
              selectedKey={columnMapping[key] ?? NO_COLUMN}
              onSelectionChange={(k) =>
                setColumnMapping({
                  ...columnMapping,
                  [key]: k === NO_COLUMN ? null : String(k),
                })
              }
            >
              <Label>
                {label}
                {required ? " (required)" : ""}
              </Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox className="max-h-64 overflow-y-auto">
                  <ListBox.Item id={NO_COLUMN}>— None —</ListBox.Item>
                  {parsedCsv.headers.map((header) => (
                    <ListBox.Item key={header} id={header}>
                      {header}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ))}
          <Button onPress={handleColumnsNext}>Next: Value Mapping</Button>
        </div>
      )}

      {step === "values" && (
        <div className="flex flex-col gap-6">
          {ascentStyleValues.length > 0 && (
            <div className="flex flex-col gap-2">
              <p id={ascentValuesHeadingId} className="text-sm font-medium">
                Ascent Style Values
              </p>
              {ascentStyleValues.map((value, index) => {
                const rowLabelId = `${ascentValuesHeadingId}-${index}`;
                return (
                  <div key={value} className="flex items-center gap-4">
                    <span id={rowLabelId} className="w-40 shrink-0 truncate text-sm">
                      {value}
                    </span>
                    <Select
                      fullWidth
                      className="flex-1"
                      aria-labelledby={`${rowLabelId} ${ascentValuesHeadingId}`}
                      selectedKey={ascentStyleMapping[value] ?? "skip"}
                      onSelectionChange={(k) =>
                        setAscentStyleMapping({
                          ...ascentStyleMapping,
                          [value]: String(k) as AscentStyle | "skip",
                        })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {ASCENT_STYLES.map((t) => (
                            <ListBox.Item key={t} id={t}>
                              {t}
                            </ListBox.Item>
                          ))}
                          <ListBox.Item id="skip">Skip these rows</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}

          {climbTypeValues.length > 0 && (
            <div className="flex flex-col gap-2">
              <p id={climbTypeValuesHeadingId} className="text-sm font-medium">
                Climb Type Values (used only to break ties for ambiguous matches)
              </p>
              {climbTypeValues.map((value, index) => {
                const rowLabelId = `${climbTypeValuesHeadingId}-${index}`;
                return (
                  <div key={value} className="flex items-center gap-4">
                    <span id={rowLabelId} className="w-40 shrink-0 truncate text-sm">
                      {value}
                    </span>
                    <Select
                      fullWidth
                      className="flex-1"
                      aria-labelledby={`${rowLabelId} ${climbTypeValuesHeadingId}`}
                      selectedKey={climbTypeMapping[value] ?? "skip"}
                      onSelectionChange={(k) =>
                        setClimbTypeMapping({
                          ...climbTypeMapping,
                          [value]: String(k) as (typeof CLIMB_TYPES)[number] | "skip",
                        })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {CLIMB_TYPES.map((t) => (
                            <ListBox.Item key={t} id={t}>
                              {t}
                            </ListBox.Item>
                          ))}
                          <ListBox.Item id="skip">Ignore</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}

          {columnMapping?.date && (
            <Select
              fullWidth
              selectedKey={dateFormat}
              onSelectionChange={(k) => setDateFormat(String(k) as DateFormat)}
            >
              <Label>Date Format</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="iso">YYYY-MM-DD</ListBox.Item>
                  <ListBox.Item id="mdy">MM/DD/YYYY</ListBox.Item>
                  <ListBox.Item id="dmy">DD/MM/YYYY</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          )}

          {columnMapping?.grade && (
            <Select
              fullWidth
              selectedKey={gradeScale}
              onSelectionChange={(k) => setGradeScale(String(k) as "native" | "converted")}
            >
              <Label>Grade Notation</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="native">Native (V-scale / YDS)</ListBox.Item>
                  <ListBox.Item id="converted">Converted (Font / French)</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
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
              {/* Progress state only changes once per IMPORT_BATCH_SIZE-row
                  server round-trip, so this polite region announces per batch
                  rather than chattering on every row. */}
              <p className="text-sm" aria-live="polite">
                Importing… {progress.completed} / {progress.total} rows processed
              </p>
              <div
                role="progressbar"
                aria-label="Import progress"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.completed}
                className="h-2 w-full overflow-hidden rounded-full bg-surface"
              >
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
