"use client";

import { PageTitle } from "@/components/ui/typography";
import { FIELD_CLASS } from "@/components/ui/field";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, ButtonGroup, Label, TextField } from "@heroui/react";
import { formatCount } from "@/lib/format";
import { ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { importSends, type ImportResult } from "@/db/mutations";
import { downloadCsv } from "@/lib/download";
import { ASCENT_STYLES, GRADE_FEEL_VALUES, type AscentStyle, type GradeFeel } from "@/lib/sends";

// Same wording as the send form's grade-feel buttons.
const GRADE_FEEL_LABELS: Record<GradeFeel, string> = {
  low: "Low end",
  solid: "Solid",
  high: "High end",
};
import {
  buildFailedRowsCsv,
  distinctValues,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessGradeFeelMapping,
  guessColumnMapping,
  missingRequiredColumns,
  needsDateFormatChoice,
  normalizeImportRows,
  parseCsvText,
  parseDateWithFormat,
  detectDateFormat,
  CLIMB_TYPES,
  DATE_SAMPLE_SIZE,
  IMPORT_BATCH_SIZE,
  REQUIRED_COLUMN_KEYS,
  type AscentStyleMapping,
  type ClimbTypeMapping,
  type CoercionWarning,
  type GradeFeelMapping,
  type ColumnMapping,
  type DateFormat,
  type InvalidImportRow,
  type NormalizedImportRow,
  type ParsedCsv,
} from "@/lib/sends-import";

type Step = "upload" | "columns" | "values" | "review" | "result";

/** The user-visible stations of the wizard, in order — "result" renders as
 * every station done. */
const WIZARD_STATIONS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "columns", label: "Columns" },
  { key: "values", label: "Values" },
  { key: "review", label: "Review" },
];

function WizardSteps({ step }: { step: Step }) {
  const activeIndex =
    step === "result" ? WIZARD_STATIONS.length : WIZARD_STATIONS.findIndex((s) => s.key === step);

  return (
    <ol className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
      {WIZARD_STATIONS.map((station, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        return (
          <li key={station.key} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-4 bg-separator" aria-hidden />}
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={
                state === "active"
                  ? "rounded-sm border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground"
                  : state === "done"
                    ? "px-1.5 py-0.5 text-success-soft-foreground"
                    : "px-1.5 py-0.5 text-muted"
              }
            >
              {i + 1} {station.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

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

const CONFLICT_MODES = [
  { value: "skip", label: "Skip" },
  { value: "overwrite", label: "Overwrite" },
] as const;

type ImportProgress = {
  completed: number;
  total: number;
  imported: number;
  overwritten: number;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [ascentStyleMapping, setAscentStyleMapping] =
    useState<AscentStyleMapping>({});
  const [climbTypeMapping, setClimbTypeMapping] = useState<ClimbTypeMapping>({});
  const [gradeFeelMapping, setGradeFeelMapping] = useState<GradeFeelMapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>("iso");
  const [gradeScale, setGradeScale] = useState<"native" | "converted">("native");
  const [onConflict, setOnConflict] = useState<"skip" | "overwrite">("skip");

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
  const gradeFeelValues = useMemo(
    () => (parsedCsv && columnMapping ? distinctValues(parsedCsv.rows, columnMapping.gradeFeel) : []),
    [parsedCsv, columnMapping],
  );
  const dateValues = useMemo(
    () =>
      parsedCsv && columnMapping
        ? distinctValues(parsedCsv.rows, columnMapping.date).slice(0, DATE_SAMPLE_SIZE)
        : [],
    [parsedCsv, columnMapping],
  );
  // Most files answer the month-first/day-first question themselves, so the
  // setting is only shown when this one doesn't — see needsDateFormatChoice.
  const needsDateFormat = useMemo(() => needsDateFormatChoice(dateValues), [dateValues]);
  // Prefer a value the current setting can't read as the worked example: if
  // anything in the column is going to fail, that's what the user needs to
  // see, not the first row that happens to work.
  const dateSample = useMemo(
    () =>
      dateValues.find((v) => parseDateWithFormat(v, dateFormat) === null) ?? dateValues[0] ?? null,
    [dateValues, dateFormat],
  );
  const dateSamplePreview = dateSample ? parseDateWithFormat(dateSample, dateFormat) : null;

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
      // Clear the input once the contents are read, so picking the same file
      // again still fires a change event — otherwise a file rejected below
      // couldn't be re-picked after fixing it.
      input.value = "";

      const parsed = parseCsvText(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Couldn't find any data rows in that file.");
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
    const feelValues = distinctValues(parsedCsv.rows, columnMapping.gradeFeel);
    setAscentStyleMapping(guessAscentStyleMapping(ascentStyleValues));
    setClimbTypeMapping(guessClimbTypeMapping(climbValues));
    setGradeFeelMapping(guessGradeFeelMapping(feelValues));
    if (columnMapping.date) {
      const sample = distinctValues(parsedCsv.rows, columnMapping.date).slice(0, DATE_SAMPLE_SIZE);
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
      gradeFeelMapping,
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
      overwritten: 0,
      alreadyLogged: 0,
      notFound: 0,
      failed: 0,
      lastError: null,
    });

    startTransition(async () => {
      let imported = 0;
      let overwritten = 0;
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
        // The action boundary turns anything thrown server-side into
        // { ok: false }, so a rejection here is the round-trip itself failing
        // — offline, or the worker erroring outside the action. Either way
        // it's the same story for this batch: nothing committed.
        const result = await importSends(batch, { gradeScale, onConflict }).catch(
          () => ({ ok: false, error: "Import failed" }) as const,
        );
        if (result.ok) {
          imported += result.value.imported;
          overwritten += result.value.overwritten;
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
          overwritten,
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
        overwritten,
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
    setGradeFeelMapping({});
    setDateFormat("iso");
    setGradeScale("native");
    setOnConflict("skip");
    setNormalized(null);
    setProgress(null);
    setImportResult(null);
    setError(null);
    cancelRequestedRef.current = false;
    setCancelRequested(false);
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-surface-secondary p-6">
      <PageTitle className="text-2xl">Import Sends from CSV</PageTitle>

      <WizardSteps step={step} />

      {error && <p className="text-sm text-danger">{error}</p>}

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Upload a CSV export of your climbing log. You&apos;ll be able to map its columns
            and clarify a few ambiguous values before anything is imported.
          </p>
          {/* The file input stays in the DOM but hidden: it's the only way to
              open the picker, and a Button driving it keeps the styling
              consistent with the rest of the wizard. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            isDisabled={reading}
            onPress={() => fileInputRef.current?.click()}
            className="w-full lg:w-auto lg:self-start"
          >
            Choose CSV File
          </Button>
          {reading && <p className="text-sm text-muted">Reading file…</p>}
        </div>
      )}

      {step === "columns" && columnMapping && parsedCsv && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Which column in your CSV holds each field? ({formatCount(parsedCsv.rows.length, "row")} found)
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
                className={FIELD_CLASS}
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
                    className={FIELD_CLASS}
                  >
                    {ASCENT_STYLES.map((t) => (
                      <option key={t} value={t}>
                        {ASCENT_STYLE_LABELS[t]}
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
                    className={FIELD_CLASS}
                  >
                    {CLIMB_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {DISCIPLINE_LABELS[t]}
                      </option>
                    ))}
                    <option value="skip">Ignore</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {gradeFeelValues.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Grade Feel Values</p>
              {gradeFeelValues.map((value) => (
                <div key={value} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 truncate text-sm">{value}</span>
                  <select
                    value={gradeFeelMapping[value] ?? "skip"}
                    onChange={(e) =>
                      setGradeFeelMapping({
                        ...gradeFeelMapping,
                        [value]: e.target.value as GradeFeel | "skip",
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    {GRADE_FEEL_VALUES.map((t) => (
                      <option key={t} value={t}>
                        {GRADE_FEEL_LABELS[t]}
                      </option>
                    ))}
                    <option value="skip">Ignore (use solid)</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {columnMapping?.date && (
            <div className="flex flex-col gap-2">
              {/* Only asked when the file is genuinely ambiguous. A column of
                  "2019-10-15" or "Sun Sep 22 2019" reads the same way under
                  every option, and offering a choice that changes nothing
                  reads as "your dates aren't supported". */}
              {needsDateFormat ? (
                <>
                  <TextField>
                    <Label>Date Format</Label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                      className={FIELD_CLASS}
                    >
                      <option value="iso">Year first — 2019-10-15</option>
                      <option value="mdy">Month first — 10/15/2019</option>
                      <option value="dmy">Day first — 15/10/2019</option>
                    </select>
                  </TextField>
                  <p className="text-xs text-muted">
                    This file has all-numeric dates, where 05/06/2019 could be either May 6th
                    or June 5th — only you can settle which.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  Dates are being read automatically — nothing in this column is ambiguous.
                </p>
              )}
              {/* A worked example from the file itself: the setting is easy to
                  get backwards, and this shows the mistake before the import
                  rather than after. */}
              {dateSample && (
                <p className="text-xs text-muted">
                  {dateSamplePreview
                    ? `“${dateSample}” will import as ${dateSamplePreview}.`
                    : `“${dateSample}” can’t be read as a date${needsDateFormat ? " this way" : ""}.`}
                </p>
              )}
            </div>
          )}

          {(columnMapping?.grade || columnMapping?.suggestedGrade) && (
            <TextField>
              <Label>Grade Notation</Label>
              <select
                value={gradeScale}
                onChange={(e) => setGradeScale(e.target.value as "native" | "converted")}
                className={FIELD_CLASS}
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
            <strong>{formatCount(normalized.valid.length, "row")}</strong> ready to import.
            {normalized.invalid.length > 0 && (
              <>
                {" "}
                <strong>{formatCount(normalized.invalid.length, "row")}</strong> can&apos;t be
                imported.
              </>
            )}
          </p>

          {normalized.invalid.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
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
                {progress.imported} imported &middot;{" "}
                {onConflict === "overwrite" && <>{progress.overwritten} overwritten &middot; </>}
                {progress.alreadyLogged} already logged &middot; {progress.notFound} not found
                &middot; {progress.failed} failed
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
            <>
              <TextField>
                <Label>Already-logged climbs</Label>
                <ButtonGroup className="w-full lg:w-auto lg:self-start">
                  {CONFLICT_MODES.map(({ value, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={onConflict === value ? undefined : "outline"}
                      onPress={() => setOnConflict(value)}
                      className="flex-1 lg:flex-none"
                    >
                      {label}
                    </Button>
                  ))}
                </ButtonGroup>
              </TextField>
              {onConflict === "overwrite" ? (
                <p className="text-sm text-danger">
                  CSV values will replace your existing send data for any already-logged climbs.
                  This cannot be undone.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Climbs you&apos;ve already logged are left untouched and counted as already
                  logged.
                </p>
              )}

              <div className="flex gap-4">
                <Button variant="ghost" onPress={() => goBack("values")}>
                  Back
                </Button>
                <Button onPress={handleFinalize} isDisabled={normalized.valid.length === 0}>
                  Finalize Import
                </Button>
              </div>
            </>
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
            {importResult.overwritten > 0 && (
              <>
                {" "}
                Replaced <strong>{importResult.overwritten}</strong> existing{" "}
                {importResult.overwritten === 1 ? "send" : "sends"}.
              </>
            )}
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
              <summary className="cursor-pointer text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
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
