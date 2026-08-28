"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Label, TextField } from "@heroui/react";
import { importSends, type ImportResult } from "@/db/mutations";
import { downloadCsv } from "@/lib/download";
import { ASCENT_STYLES, type AscentStyle } from "@/lib/sends";
import {
  buildFailedRowsCsv,
  distinctValues,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessColumnMapping,
  missingRequiredColumns,
  normalizeImportRows,
  parseCsvText,
  detectDateFormat,
  CLIMB_TYPES,
  IMPORT_BATCH_SIZE,
  REQUIRED_COLUMN_KEYS,
  type AscentStyleMapping,
  type ClimbTypeMapping,
  type CoercionWarning,
  type ColumnMapping,
  type DateFormat,
  type InvalidImportRow,
  type NormalizedImportRow,
  type ParsedCsv,
} from "@/lib/sends-import";

type Step = "upload" | "columns" | "values" | "review" | "result";

const COLUMN_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "date", label: "Date Sent" },
  { key: "ascentStyle", label: "Ascent Style" },
  { key: "climbName", label: "Climb Name" },
  { key: "areaName", label: "Area Name" },
  { key: "climbType", label: "Climb Type (tiebreaker only)" },
  { key: "grade", label: "Grade" },
  { key: "suggestedGrade", label: "Suggested Grade" },
  { key: "gradeFeel", label: "Grade Feel" },
  { key: "rating", label: "Rating" },
  { key: "comment", label: "Comment" },
];

function columnLabel(key: keyof ColumnMapping): string {
  return COLUMN_FIELDS.find((f) => f.key === key)?.label ?? key;
}

type ImportProgress = {
  completed: number;
  total: number;
  imported: number;
  alreadyLogged: number;
  notFound: number;
  failed: number; // rows from failed batches (importSends commits atomically, so a failed batch wrote nothing)
  lastError: string | null; // most recent batch error, surfaced while the import is still running
};

type BatchError = { rows: NormalizedImportRow[]; message: string };
type WizardResult = ImportResult & {
  batchErrors: BatchError[];
  /** Rows never sent to the server because the import stopped early. */
  notAttempted: NormalizedImportRow[];
  stopped: { kind: "cancelled" | "aborted"; message: string } | null;
};

/** Stop the import once this many batches in a row fail outright — after
 * three, the cause is almost certainly systemic (expired session, network
 * down), and marching through the rest of a large CSV would just fail 80
 * more times. */
const MAX_CONSECUTIVE_FAILED_BATCHES = 3;

/** The result screen lists at most this many per-row failures inline; the
 * downloadable CSV is always the full record. */
const MAX_LISTED_FAILURES = 50;

const NOT_ATTEMPTED_MESSAGE = "the import stopped before reaching this row";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
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
    warnings: CoercionWarning[];
  } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<WizardResult | null>(null);

  // Cancellation is a ref + state pair: the ref is what the finalize loop
  // polls between batches (state updates wouldn't be visible inside the
  // running async closure), the state is what the UI renders.
  const cancelRequestedRef = useRef(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  // While batches are in flight, closing or reloading the tab wouldn't roll
  // anything back — committed batches are kept — but it would silently lose
  // the progress and the final report, so ask the browser to confirm.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const ascentStyleValues = useMemo(
    () => (parsedCsv && columnMapping ? distinctValues(parsedCsv.rows, columnMapping.ascentStyle) : []),
    [parsedCsv, columnMapping],
  );
  const climbTypeValues = useMemo(
    () => (parsedCsv && columnMapping ? distinctValues(parsedCsv.rows, columnMapping.climbType) : []),
    [parsedCsv, columnMapping],
  );

  // Every not-imported row as one display line, in the same order the
  // downloadable failed-rows CSV lists them. Rendered capped at
  // MAX_LISTED_FAILURES; the CSV is always the full record.
  const failureItems = useMemo(() => {
    if (!importResult || !normalized) return [];
    return [
      ...normalized.invalid.map((row) => `Row ${row.rowIndex + 1}: ${row.reason}`),
      ...importResult.notFound.map(
        (row) =>
          `${row.climbName} (${row.areaName}): ${
            row.reason === "climb-not-found"
              ? "no climb with this name in this area"
              : "more than one climb matches this name and area"
          }`,
      ),
      ...importResult.batchErrors.flatMap((batch) =>
        batch.rows.map((row) => `${row.climbName} (${row.areaName}): failed — ${batch.message}`),
      ),
      ...importResult.notAttempted.map(
        (row) => `${row.climbName} (${row.areaName}): ${NOT_ATTEMPTED_MESSAGE}`,
      ),
    ];
  }, [importResult, normalized]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setReading(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Couldn't find any data rows in that file.");
        // Clear the input so re-selecting the same file fires onChange again.
        input.value = "";
        return;
      }

      const mapping = guessColumnMapping(parsed.headers);
      setParsedCsv(parsed);
      setColumnMapping(mapping);
      setStep("columns");
    } catch {
      setError("Couldn't read that file. Re-save it as a plain CSV and try again.");
      input.value = "";
    } finally {
      setReading(false);
    }
  }

  function handleColumnsNext() {
    if (!parsedCsv || !columnMapping) return;
    const missing = missingRequiredColumns(columnMapping);
    if (missing.length > 0) {
      setError(
        `Map the required column${missing.length > 1 ? "s" : ""} before continuing: ${missing
          .map(columnLabel)
          .join(", ")}.`,
      );
      return;
    }
    setError(null);
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
    setError(null);
    const result = normalizeImportRows(
      parsedCsv,
      columnMapping,
      ascentStyleMapping,
      climbTypeMapping,
      dateFormat,
      { gradeScalePreference: gradeScale },
    );
    setNormalized(result);
    setStep("review");
  }

  function goBack(target: Step) {
    setError(null);
    setStep(target);
  }

  function handleFinalize() {
    if (!normalized) return;
    setError(null);
    cancelRequestedRef.current = false;
    setCancelRequested(false);
    const total = normalized.valid.length;
    setProgress({
      completed: 0,
      total,
      imported: 0,
      alreadyLogged: 0,
      notFound: 0,
      failed: 0,
      lastError: null,
    });

    startTransition(async () => {
      let imported = 0;
      let alreadyLogged = 0;
      let failedRows = 0;
      let lastError: string | null = null;
      let consecutiveFailures = 0;
      let stopped: WizardResult["stopped"] = null;
      let nextIndex = 0;
      const notFound: ImportResult["notFound"] = [];
      const batchErrors: BatchError[] = [];

      while (nextIndex < total) {
        const batch = normalized.valid.slice(nextIndex, nextIndex + IMPORT_BATCH_SIZE);
        const result = await importSends(batch, gradeScale);
        if (result.ok) {
          imported += result.value.imported;
          alreadyLogged += result.value.alreadyLogged;
          notFound.push(...result.value.notFound);
          consecutiveFailures = 0;
        } else {
          // importSends commits each call atomically, so a failed call
          // means none of this batch's rows were written.
          batchErrors.push({ rows: batch, message: result.error });
          failedRows += batch.length;
          lastError = result.error;
          consecutiveFailures++;
        }
        nextIndex += batch.length;
        setProgress({
          completed: nextIndex,
          total,
          imported,
          alreadyLogged,
          notFound: notFound.length,
          failed: failedRows,
          lastError,
        });

        if (nextIndex >= total) break;
        if (cancelRequestedRef.current) {
          stopped = { kind: "cancelled", message: "You cancelled the import." };
          break;
        }
        if (!result.ok && consecutiveFailures >= MAX_CONSECUTIVE_FAILED_BATCHES) {
          stopped = {
            kind: "aborted",
            message: `The import stopped after ${MAX_CONSECUTIVE_FAILED_BATCHES} failed batches in a row. Last error: ${result.error}`,
          };
          break;
        }
      }

      setImportResult({
        imported,
        alreadyLogged,
        notFound,
        batchErrors,
        notAttempted: normalized.valid.slice(nextIndex),
        stopped,
      });
      setStep("result");
    });
  }

  function handleCancel() {
    cancelRequestedRef.current = true;
    setCancelRequested(true);
  }

  function handleDownloadFailedRows() {
    if (!importResult || !normalized || !parsedCsv) return;
    const csvText = buildFailedRowsCsv(
      parsedCsv.headers,
      normalized.invalid,
      importResult.notFound,
      [
        ...importResult.batchErrors,
        ...(importResult.notAttempted.length > 0
          ? [{ rows: importResult.notAttempted, message: NOT_ATTEMPTED_MESSAGE }]
          : []),
      ],
    );
    downloadCsv(csvText, "failed-sends-import.csv");
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
    cancelRequestedRef.current = false;
    setCancelRequested(false);
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
          <input type="file" accept=".csv" onChange={handleFileChange} disabled={reading} />
          {reading && <p className="text-sm text-muted">Reading file…</p>}
        </div>
      )}

      {step === "columns" && columnMapping && parsedCsv && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Which column in your CSV holds each field? ({parsedCsv.rows.length} rows found)
          </p>
          {parsedCsv.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-warning">
              {parsedCsv.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          )}
          {COLUMN_FIELDS.map(({ key, label }) => (
            <TextField key={key}>
              <Label>
                {label}
                {REQUIRED_COLUMN_KEYS.includes(key) ? " (required)" : ""}
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

          {(columnMapping?.grade || columnMapping?.suggestedGrade) && (
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
            <Button variant="ghost" onPress={() => goBack("columns")}>
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

          {normalized.warnings.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm">Some values will be adjusted during import:</p>
              <ul className="flex flex-col gap-1 text-xs text-warning">
                {normalized.warnings.map((warning) => (
                  <li key={warning.field}>
                    {warning.count} {warning.count === 1 ? "row" : "rows"}: {warning.message} (
                    {warning.examples.join("; ")}
                    {warning.count > warning.examples.length ? "; …" : ""})
                  </li>
                ))}
              </ul>
            </div>
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
              {progress.lastError && (
                <p className="text-xs text-danger">
                  {progress.failed} {progress.failed === 1 ? "row has" : "rows have"} failed so
                  far. Latest error: {progress.lastError}
                </p>
              )}
              <div>
                <Button variant="ghost" onPress={handleCancel} isDisabled={cancelRequested}>
                  {cancelRequested ? "Stopping after the current batch…" : "Cancel Import"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <Button variant="ghost" onPress={() => goBack("values")}>
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
          {importResult.stopped && (
            <p className="text-sm text-danger">
              {importResult.stopped.message} Rows imported before it stopped were kept.
            </p>
          )}

          <p className="text-sm">
            Imported <strong>{importResult.imported}</strong> new{" "}
            {importResult.imported === 1 ? "send" : "sends"}.
            {importResult.alreadyLogged > 0 && (
              <>
                {" "}
                Skipped <strong>{importResult.alreadyLogged}</strong>{" "}
                {importResult.alreadyLogged === 1 ? "row" : "rows"} already in your logbook.
              </>
            )}
            {failureItems.length > 0 && (
              <>
                {" "}
                <strong>{failureItems.length}</strong>{" "}
                {failureItems.length === 1 ? "row was" : "rows were"} not imported.
              </>
            )}
          </p>

          {failureItems.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted">
                View rows that weren&apos;t imported
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                {failureItems.slice(0, MAX_LISTED_FAILURES).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {failureItems.length > MAX_LISTED_FAILURES && (
                  <li>
                    …and {failureItems.length - MAX_LISTED_FAILURES} more — download the CSV
                    below for the full list.
                  </li>
                )}
              </ul>
            </details>
          )}

          <div className="flex gap-4">
            {failureItems.length > 0 && (
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
