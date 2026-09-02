"use client";

import { PageTitle } from "@/components/ui/typography";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, Checkbox, Label, TextField } from "@heroui/react";
import clsx from "clsx";
import { Upload } from "lucide-react";
import { AppLink } from "@/components/ui/app-link";
import { cardClass } from "@/components/ui/card";
import { choicePillClass } from "@/components/ui/choice-pill";
import { Eyebrow, EYEBROW_CLASS } from "@/components/ui/eyebrow";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import {
  ImportMatchStep,
  defaultFilter,
  type Filter,
  type LookupStatus,
} from "@/components/import-match-step";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCount } from "@/lib/format";
import { ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { GRADE_FEEL_LABELS } from "@/components/send-form";
import { DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import {
  importSends,
  resolveImportClimbs,
  resolveImportClimbsInAreas,
  type ImportResult,
} from "@/db/mutations";
import { downloadCsv } from "@/lib/download";
import {
  ASCENT_STYLES,
  GRADE_FEEL_VALUES,
  IMPORT_BATCH_SIZE,
  RESOLVE_BATCH_SIZE,
  type ImportSendRow,
} from "@/lib/sends";
import {
  areaLookupsNeeded,
  distinctClimbNames,
  matchRows,
  mergeCandidates,
  resolveRows,
  summarizeResolved,
  type CandidateIndex,
  type ManualChoice,
  type PreferredArea,
  type ResolvedRow,
} from "@/lib/import-matching";
import {
  buildFailedRowsCsv,
  deriveSourceColumns,
  detectDateFormat,
  detectGradeScale,
  detectImportSource,
  distinctValues,
  findPlaceholderTimestamps,
  guessAscentStyleMapping,
  guessClimbTypeMapping,
  guessColumnMapping,
  guessGradeFeelMapping,
  missingRequiredColumns,
  needsDateFormatChoice,
  normalizeImportRows,
  parseCsvText,
  parseDateWithFormat,
  valueCounts,
  CLIMB_TYPES,
  DATE_SAMPLE_SIZE,
  IMPORT_SOURCE_LABELS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  REQUIRED_COLUMN_KEYS,
  type AscentStyleMapping,
  type ClimbTypeMapping,
  type CoercionWarning,
  type ColumnMapping,
  type DateFormat,
  type FailedImportRow,
  type FieldKey,
  type GradeFeelMapping,
  type GradeScale,
  type ImportSource,
  type InvalidImportRow,
  type NormalizedImportRow,
  type ParsedCsv,
} from "@/lib/sends-import";
import type { ClimbCandidate } from "@/db/queries";

type Step = "upload" | "columns" | "values" | "match" | "review" | "result";

/** The user-visible stations of the wizard, in order — "result" renders as
 * every station done. */
const WIZARD_STATIONS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "columns", label: "Columns" },
  { key: "values", label: "Values" },
  { key: "match", label: "Climbs" },
  { key: "review", label: "Review" },
];

function WizardSteps({ step, onJump }: { step: Step; onJump: ((step: Step) => void) | null }) {
  const activeIndex =
    step === "result" ? WIZARD_STATIONS.length : WIZARD_STATIONS.findIndex((s) => s.key === step);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
      {WIZARD_STATIONS.map((station, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        const label = `${i + 1} ${station.label}`;
        return (
          <li key={station.key} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-4 bg-separator" aria-hidden />}
            {state === "done" && onJump ? (
              // A finished step is a way back — the same navigation the Back
              // buttons offer, without walking through each step in between.
              <button
                type="button"
                onClick={() => onJump(station.key)}
                className="cursor-pointer rounded-sm px-1.5 py-0.5 text-success-soft-foreground hover:text-foreground focus-visible:status-focused"
              >
                {label}
              </button>
            ) : (
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
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const COLUMN_FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: "climbName", label: "Climb name", hint: "Matched against betabook's climbs by name." },
  {
    key: "ascentStyle",
    label: "Ascent style",
    hint: "Redpoint, flash, or onsight. Values are mapped on the next step.",
  },
  { key: "date", label: "Date sent", hint: "Any common date format." },
  {
    key: "areaName",
    label: "Area",
    hint: "The exact area or any parent. Leave blank to match on name alone.",
  },
  {
    key: "suggestedGrade",
    label: "Grade",
    hint: "The grade you logged, imported as your suggested grade. Blank means no suggestion.",
  },
  {
    key: "gradeFeel",
    label: "Grade feel",
    hint: "Soft, fair, or stiff. Values are mapped on the next step.",
  },
  { key: "rating", label: "Rating", hint: "1 to 5 stars." },
  { key: "comment", label: "Comment", hint: "Notes on the send." },
  { key: "climbType", label: "Climb type", hint: "Only used to tell same-named climbs apart." },
  {
    key: "grade",
    label: "Posted grade",
    hint: "The climb's guidebook grade, if the file has it as a separate column. Only used when no Grade column is mapped.",
  },
];

/** The first few values of a column, short enough to sit under its select. */
function previewText(values: string[]): string {
  return values
    .slice(0, 3)
    .map((value) => (value.length > 32 ? `${value.slice(0, 31)}…` : value))
    .join(" · ");
}

function columnLabel(key: FieldKey): string {
  return COLUMN_FIELDS.find((f) => f.key === key)?.label ?? key;
}

// Column pickers key their options by prefixed header, so no header text can
// collide with the "None" choice.
const NO_COLUMN = "none";
const columnKey = (header: string) => `h:${header}`;
const headerOf = (key: string): string | null => (key === NO_COLUMN ? null : key.slice(2));

const DATE_FORMAT_OPTIONS: readonly SelectOption<DateFormat>[] = [
  { value: "iso", label: "Year first — 2019-10-15" },
  { value: "mdy", label: "Month first — 10/15/2019" },
  { value: "dmy", label: "Day first — 15/10/2019" },
];

const GRADE_SCALE_OPTIONS: readonly SelectOption<GradeScale>[] = [
  { value: "native", label: "Native (V-scale / YDS)" },
  { value: "converted", label: "Converted (Font / French)" },
];

const SOURCE_NOTES: Record<Exclude<ImportSource, "unknown">, string> = {
  betabook: "Every column maps back to the field it was exported from.",
  kaya:
    "KAYA has no area column. Its “location” is the boulder and “country” the country, so both are used as hints when a climb name matches in more than one place.",
  sendage: "“Country” is used as a hint when a climb name matches in more than one place.",
  mountainproject:
    "“Rating” is the route's grade and “Your Rating” yours. “Location” is the full area path, used as hints from the wall up. Ascent style comes from “Lead Style”, or from “Style” where that is blank.",
};

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
  failed: number; // rows from failed batches (importSends commits atomically, so a failed batch wrote nothing)
  lastError: string | null; // most recent batch error, surfaced while the import is still running
};

type BatchError = { rows: ResolvedRow[]; message: string };
type WizardResult = Omit<ImportResult, "missing"> & {
  /** Rows whose climb was gone by the time the batch ran. */
  missing: ResolvedRow[];
  batchErrors: BatchError[];
  /** Rows never sent to the server because the import stopped early. */
  notAttempted: ResolvedRow[];
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

function toImportSendRow(resolved: ResolvedRow, climb: ClimbCandidate): ImportSendRow {
  const { row } = resolved;
  return {
    climbId: climb.id,
    ascentStyle: row.ascentStyle,
    dateSent: row.dateSent,
    rating: row.rating,
    comment: row.comment,
    gradeFeel: row.gradeFeel,
    gradeText: row.gradeText,
    blankGradeMeans: row.blankGradeMeans,
  };
}

/** A stat the review and result steps lead with — the number, then what it
 * counts. */
function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={EYEBROW_CLASS}>{label}</span>
      <span
        className={clsx(
          "font-display text-3xl font-semibold tabular-nums",
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function ValueMappingSection<V extends string>({
  title,
  description,
  values,
  mapping,
  onChange,
  options,
  skipLabel,
}: {
  title: string;
  description?: string;
  values: { value: string; count: number }[];
  mapping: Record<string, V | "skip">;
  onChange: (mapping: Record<string, V | "skip">) => void;
  options: readonly SelectOption<V>[];
  skipLabel: string;
}) {
  if (values.length === 0) return null;
  const choices: readonly SelectOption<V | "skip">[] = [...options, { value: "skip", label: skipLabel }];
  return (
    <section className="flex flex-col gap-3">
      <div>
        <Eyebrow>{title}</Eyebrow>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {/* Value and count share a row with the select from sm up; on a phone
        * the select drops to its own full-width row underneath. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(11rem,auto)]">
        {values.map(({ value, count }) => (
          <div key={value} className="contents">
            <span className="text-sm break-words">{value}</span>
            <span className="text-xs text-muted tabular-nums">{formatCount(count, "row")}</span>
            <OptionSelect
              ariaLabel={`Map “${value}”`}
              value={mapping[value] ?? "skip"}
              onChange={(chosen) => onChange({ ...mapping, [value]: chosen })}
              options={choices}
              className="col-span-2 mb-2 sm:col-span-1 sm:mb-0"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const ASCENT_STYLE_OPTIONS = ASCENT_STYLES.map((value) => ({ value, label: ASCENT_STYLE_LABELS[value] }));
const CLIMB_TYPE_OPTIONS = CLIMB_TYPES.map((value) => ({ value, label: DISCIPLINE_LABELS[value] }));
const GRADE_FEEL_OPTIONS = GRADE_FEEL_VALUES.map((value) => ({ value, label: GRADE_FEEL_LABELS[value] }));

export function ImportWizard({ profileHref }: { profileHref: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [source, setSource] = useState<ImportSource>("unknown");
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [ascentStyleMapping, setAscentStyleMapping] =
    useState<AscentStyleMapping>({});
  const [climbTypeMapping, setClimbTypeMapping] = useState<ClimbTypeMapping>({});
  const [gradeFeelMapping, setGradeFeelMapping] = useState<GradeFeelMapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>("iso");
  const [dropPlaceholderDates, setDropPlaceholderDates] = useState(false);
  const [gradeScale, setGradeScale] = useState<GradeScale>("native");
  const [onConflict, setOnConflict] = useState<"skip" | "overwrite">("skip");

  const [normalized, setNormalized] = useState<{
    valid: NormalizedImportRow[];
    invalid: InvalidImportRow[];
    warnings: CoercionWarning[];
  } | null>(null);

  // The match step's data: what the server knows about every climb name in
  // the file, and what the user decided on top of the automatic matching.
  const [candidateIndex, setCandidateIndex] = useState<CandidateIndex | null>(null);
  const [lookup, setLookup] = useState<LookupStatus>({ phase: "done" });
  const lookupRunRef = useRef(0);
  const [preferredAreas, setPreferredAreas] = useState<PreferredArea[]>([]);
  const [manual, setManual] = useState<ReadonlyMap<number, ManualChoice>>(new Map());
  const [matchFilter, setMatchFilter] = useState<Filter | null>(null);

  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<WizardResult | null>(null);

  // True when a recognized export skipped the columns and values steps, so
  // the match step can say so and offer the way back.
  const [autoMapped, setAutoMapped] = useState(false);

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

  const rows = useMemo(() => parsedCsv?.rows ?? [], [parsedCsv]);
  const ascentStyleValues = useMemo(
    () => valueCounts(rows, columnMapping?.ascentStyle ?? null),
    [rows, columnMapping?.ascentStyle],
  );
  const climbTypeValues = useMemo(
    () => valueCounts(rows, columnMapping?.climbType ?? null),
    [rows, columnMapping?.climbType],
  );
  const gradeFeelValues = useMemo(
    () => valueCounts(rows, columnMapping?.gradeFeel ?? null),
    [rows, columnMapping?.gradeFeel],
  );
  const dateValues = useMemo(
    () => distinctValues(rows, columnMapping?.date ?? null).slice(0, DATE_SAMPLE_SIZE),
    [rows, columnMapping?.date],
  );
  // KAYA's stand-in for "no date" — see findPlaceholderTimestamps.
  const placeholderDates = useMemo(
    () => findPlaceholderTimestamps(rows, columnMapping?.date ?? null),
    [rows, columnMapping?.date],
  );
  const placeholderRowCount = placeholderDates.reduce((sum, p) => sum + p.count, 0);

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

  // The first few values of each column, so a mapping can be checked at a
  // glance instead of by remembering what the file looked like.
  const columnPreviews = useMemo(() => {
    const previews = new Map<string, string>();
    for (const column of [...(parsedCsv?.headers ?? []), ...(parsedCsv?.derived ?? [])]) {
      previews.set(column, previewText(distinctValues(rows, column)));
    }
    return previews;
  }, [parsedCsv?.headers, parsedCsv?.derived, rows]);

  // Matching is the expensive half and never reads the user's choices, so a
  // pick or skip only re-runs the cheap overlay below.
  const matches = useMemo(
    () =>
      normalized && candidateIndex
        ? matchRows(normalized.valid, candidateIndex, { gradeScale, preferredAreas })
        : null,
    [normalized, candidateIndex, gradeScale, preferredAreas],
  );
  const resolved = useMemo(
    () => (normalized && matches ? resolveRows(normalized.valid, matches, manual) : null),
    [normalized, matches, manual],
  );
  const summary = useMemo(() => (resolved ? summarizeResolved(resolved) : null), [resolved]);

  // Every not-imported row, in CSV order. The list is capped at
  // MAX_LISTED_FAILURES; the downloadable CSV is the full record.
  const failures = useMemo((): (FailedImportRow & { rowIndex: number; label: string | null })[] => {
    if (!importResult || !normalized || !resolved) return [];
    const fromResolved = (r: ResolvedRow, reason: string) => ({
      rowIndex: r.row.rowIndex,
      raw: r.row.raw,
      label: r.row.climbName,
      reason,
    });
    return [
      ...normalized.invalid.map((row) => ({
        rowIndex: row.rowIndex,
        raw: row.raw,
        label: null,
        reason: row.reason,
      })),
      ...resolved.flatMap((r) =>
        r.state === "skipped"
          ? [fromResolved(r, "Skipped")]
          : r.state === "attention"
            ? [
                fromResolved(
                  r,
                  r.match.kind === "none"
                    ? "No climb with this name"
                    : (r.match.kind === "ambiguous" && r.match.conflict) ||
                        "Several climbs share this name and none was picked",
                ),
              ]
            : [],
      ),
      ...importResult.missing.map((r) => fromResolved(r, "Climb no longer exists")),
      ...importResult.batchErrors.flatMap((batch) =>
        batch.rows.map((r) => fromResolved(r, `Not imported: ${batch.message}`)),
      ),
      ...importResult.notAttempted.map((r) => fromResolved(r, `Not imported: ${NOT_ATTEMPTED_MESSAGE}`)),
    ].sort((a, b) => a.rowIndex - b.rowIndex);
  }, [importResult, normalized, resolved]);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("That CSV is larger than 10 MB. Split it into smaller files and try again.");
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.rows.length > MAX_IMPORT_ROWS) {
        setError(
          `That CSV has more than ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows. Split it into smaller files and try again.`,
        );
        return;
      }
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Couldn't find any data rows in that file.");
        return;
      }

      const detected = detectImportSource(parsed.headers);
      const withDerived = deriveSourceColumns(parsed, detected);
      const mapping = guessColumnMapping([...withDerived.headers, ...withDerived.derived]);
      // Only KAYA is known to stamp undated sends with the export time, so
      // only its files start with the cleanup on; elsewhere it's an offer.
      const dropPlaceholders = detected === "kaya";
      setParsedCsv(withDerived);
      setSource(detected);
      setColumnMapping(mapping);
      setDropPlaceholderDates(dropPlaceholders);

      // A recognized export has nothing to ask on the columns and values
      // steps: the preset maps every column and every value it exports.
      // Both steps stay reachable from the step list for anyone who wants
      // to change a mapping.
      if (detected !== "unknown" && missingRequiredColumns(mapping).length === 0) {
        const values = guessValueMappings(withDerived, mapping);
        setAscentStyleMapping(values.ascentStyleMapping);
        setClimbTypeMapping(values.climbTypeMapping);
        setGradeFeelMapping(values.gradeFeelMapping);
        setDateFormat(values.dateFormat);
        setGradeScale(values.gradeScale);
        setAutoMapped(true);
        beginMatching(withDerived, mapping, values, dropPlaceholders);
      } else {
        setStep("columns");
      }
    } catch {
      setError("Couldn't read that file. Re-save it as a plain CSV and try again.");
    } finally {
      setReading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Clear the input right away so picking the same file again still fires
    // a change event — otherwise a file rejected below couldn't be re-picked
    // after fixing it.
    input.value = "";
    if (file) void handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  /** The values step's starting point for a column mapping. */
  function guessValueMappings(parsed: ParsedCsv, mapping: ColumnMapping) {
    const dateSample = distinctValues(parsed.rows, mapping.date).slice(0, DATE_SAMPLE_SIZE);
    return {
      ascentStyleMapping: guessAscentStyleMapping(distinctValues(parsed.rows, mapping.ascentStyle)),
      climbTypeMapping: guessClimbTypeMapping(distinctValues(parsed.rows, mapping.climbType)),
      gradeFeelMapping: guessGradeFeelMapping(distinctValues(parsed.rows, mapping.gradeFeel)),
      dateFormat: mapping.date ? detectDateFormat(dateSample) : ("iso" as DateFormat),
      gradeScale: detectGradeScale(
        distinctValues(parsed.rows, mapping.suggestedGrade ?? mapping.grade),
      ),
    };
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
    const values = guessValueMappings(parsedCsv, columnMapping);
    setAscentStyleMapping(values.ascentStyleMapping);
    setClimbTypeMapping(values.climbTypeMapping);
    setGradeFeelMapping(values.gradeFeelMapping);
    setDateFormat(values.dateFormat);
    setGradeScale(values.gradeScale);
    setStep("values");
  }

  /** Normalizes the rows and moves to the match step, looking up climb
   * names as it goes. Takes its inputs explicitly rather than from state so
   * the upload step can call it in the same tick it set that state. */
  function beginMatching(
    parsed: ParsedCsv,
    mapping: ColumnMapping,
    values: ReturnType<typeof guessValueMappings>,
    dropPlaceholders: boolean,
  ) {
    const result = normalizeImportRows(
      parsed,
      mapping,
      values.ascentStyleMapping,
      values.climbTypeMapping,
      values.gradeFeelMapping,
      values.dateFormat,
      {
        gradeScalePreference: values.gradeScale,
        undatedValues: dropPlaceholders
          ? findPlaceholderTimestamps(parsed.rows, mapping.date).map((p) => p.value)
          : [],
      },
    );
    setNormalized(result);
    // Earlier picks were about earlier rows: a changed mapping can move or
    // remove the rows they pointed at, so they don't carry over.
    setManual(new Map());
    setStep("match");
    void runLookup(result.valid, values.gradeScale);
  }

  function handleValuesNext() {
    if (!parsedCsv || !columnMapping) return;
    setError(null);
    beginMatching(
      parsedCsv,
      columnMapping,
      { ascentStyleMapping, climbTypeMapping, gradeFeelMapping, dateFormat, gradeScale },
      dropPlaceholderDates,
    );
  }

  /** Asks the server about every distinct climb name, RESOLVE_BATCH_SIZE at
   * a time, then again about any name the per-name cap cut short where the
   * CSV says which area it's in (see areaLookupsNeeded). Progress counts
   * requests. A run that's been superseded (the user went back and
   * re-entered the step) writes nothing. `scale` is passed rather than read
   * from state because the upload step calls this in the tick that sets it. */
  async function runLookup(valid: NormalizedImportRow[], scale: GradeScale) {
    const run = ++lookupRunRef.current;
    const chunk = <T,>(items: T[]): T[][] =>
      Array.from({ length: Math.ceil(items.length / RESOLVE_BATCH_SIZE) }, (_, i) =>
        items.slice(i * RESOLVE_BATCH_SIZE, (i + 1) * RESOLVE_BATCH_SIZE),
      );
    setCandidateIndex(null);
    setMatchFilter(null);

    const nameChunks = chunk(distinctClimbNames(valid));
    let done = 0;
    let total = nameChunks.length;
    setLookup({ phase: "loading", done, total });

    // Each request settles into the shared index, or ends the run: the action
    // boundary turns server errors into { ok: false }, so a rejection here is
    // the round-trip itself failing.
    let index: CandidateIndex = new Map();
    const request = async (
      call: () => Promise<{ ok: true; value: ClimbCandidate[] } | { ok: false; error: string }>,
    ): Promise<boolean> => {
      const result = await call().catch(
        () => ({ ok: false, error: "The lookup request failed" }) as const,
      );
      if (lookupRunRef.current !== run) return false;
      if (!result.ok) {
        setLookup({ phase: "failed", error: result.error });
        return false;
      }
      index = mergeCandidates(index, result.value);
      done++;
      setLookup({ phase: "loading", done, total });
      return true;
    };

    for (const names of nameChunks) {
      if (!(await request(() => resolveImportClimbs(names)))) return;
    }

    const pairChunks = chunk(areaLookupsNeeded(valid, index));
    total += pairChunks.length;
    for (const pairs of pairChunks) {
      if (!(await request(() => resolveImportClimbsInAreas(pairs)))) return;
    }

    setCandidateIndex(index);
    const summary = summarizeResolved(
      resolveRows(valid, matchRows(valid, index, { gradeScale: scale, preferredAreas }), new Map()),
    );
    setMatchFilter(defaultFilter(summary));
    setLookup({ phase: "done" });
  }

  function handleMatchNext() {
    setError(null);
    setStep("review");
  }

  function goBack(target: Step) {
    setError(null);
    // Visiting either mapping step means the user has seen the mappings; the
    // "mapped automatically" note would then be stale.
    if (target === "columns" || target === "values") setAutoMapped(false);
    setStep(target);
  }

  function handleFinalize() {
    if (!resolved) return;
    setError(null);
    cancelRequestedRef.current = false;
    setCancelRequested(false);
    const toImport = resolved.filter((r) => r.climb !== null);
    const total = toImport.length;
    setProgress({
      completed: 0,
      total,
      imported: 0,
      overwritten: 0,
      alreadyLogged: 0,
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
      const missing: ResolvedRow[] = [];
      const batchErrors: BatchError[] = [];

      while (nextIndex < total) {
        const batch = toImport.slice(nextIndex, nextIndex + IMPORT_BATCH_SIZE);
        // The action boundary turns anything thrown server-side into
        // { ok: false }, so a rejection here is the round-trip itself failing
        // — offline, or the worker erroring outside the action. Either way
        // it's the same story for this batch: nothing committed.
        const result = await importSends(
          batch.map((r) => toImportSendRow(r, r.climb!)),
          { gradeScale, onConflict },
        ).catch(() => ({ ok: false, error: "Import failed" }) as const);
        if (result.ok) {
          imported += result.value.imported;
          overwritten += result.value.overwritten;
          alreadyLogged += result.value.alreadyLogged;
          missing.push(...result.value.missing.map((i) => batch[i]));
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
        missing,
        batchErrors,
        notAttempted: toImport.slice(nextIndex),
        stopped,
      });
      setStep("result");
    });
  }

  function applyChoices(choices: { rowIndex: number; choice: ManualChoice | null }[]) {
    setManual((prev) => {
      const next = new Map(prev);
      for (const { rowIndex, choice } of choices) {
        if (choice) next.set(rowIndex, choice);
        else next.delete(rowIndex);
      }
      return next;
    });
  }

  function handleCancel() {
    cancelRequestedRef.current = true;
    setCancelRequested(true);
  }

  function handleDownloadFailedRows() {
    if (!parsedCsv) return;
    downloadCsv(buildFailedRowsCsv(parsedCsv.headers, failures), "failed-sends-import.csv");
  }

  function reset() {
    lookupRunRef.current++;
    setStep("upload");
    setParsedCsv(null);
    setSource("unknown");
    setColumnMapping(null);
    setAscentStyleMapping({});
    setClimbTypeMapping({});
    setGradeFeelMapping({});
    setDateFormat("iso");
    setDropPlaceholderDates(false);
    setGradeScale("native");
    setOnConflict("skip");
    setNormalized(null);
    setAutoMapped(false);
    setCandidateIndex(null);
    setLookup({ phase: "done" });
    setPreferredAreas([]);
    setManual(new Map());
    setMatchFilter(null);
    setProgress(null);
    setImportResult(null);
    setError(null);
    cancelRequestedRef.current = false;
    setCancelRequested(false);
  }

  const headers = parsedCsv?.headers ?? [];
  // Mappable columns: the file's own plus any derived for its source.
  const columns = [...headers, ...(parsedCsv?.derived ?? [])];
  const mappedHeaders = new Set(
    columnMapping
      ? COLUMN_FIELDS.map(({ key }) => columnMapping[key]).filter((h): h is string => h !== null)
      : [],
  );

  const renderColumnField = ({ key, label, hint }: (typeof COLUMN_FIELDS)[number]): ReactNode => {
    if (!columnMapping) return null;
    const value = columnMapping[key];
    const preview = value ? columnPreviews.get(value) : null;
    return (
      // min-w-0: a grid cell otherwise grows to its content's width, and a
      // long preview line would push the whole column past a phone screen.
      <TextField key={key} className="min-w-0">
        <Label>{label}</Label>
        <OptionSelect
          ariaLabel={label}
          value={value ? columnKey(value) : NO_COLUMN}
          onChange={(chosen) => setColumnMapping({ ...columnMapping, [key]: headerOf(chosen) })}
          options={[
            { value: NO_COLUMN, label: "None" },
            ...columns.map((column) => ({ value: columnKey(column), label: column })),
          ]}
        />
        <p className="mt-1.5 text-xs text-muted break-words">
          {preview ? `From the file: ${preview}` : hint}
        </p>
      </TextField>
    );
  };

  return (
    <div className={`flex flex-col gap-6 ${cardClass("md")}`}>
      <div className="flex flex-col gap-3">
        <PageTitle className="text-2xl">Import sends</PageTitle>
        <WizardSteps step={step} onJump={pending || step === "result" ? null : goBack} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Upload a CSV export of your climbing log. Mountain Project, KAYA, Sendage, and
            betabook exports are recognized and mapped automatically. Any CSV with a climb name
            and an ascent style column works.
          </p>
          {/* The file input stays in the DOM but hidden: it's the only way to
              open the picker, and the drop zone drives it so the styling
              stays consistent with the rest of the wizard. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a CSV file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={clsx(
              "flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors focus-visible:status-focused",
              dragging ? "border-accent bg-surface" : "border-border hover:bg-surface/60",
            )}
          >
            <Upload className="size-6 text-muted" aria-hidden />
            <p className="text-sm">
              {reading ? "Reading file…" : "Drop a CSV here, or choose a file"}
            </p>
            <p className="text-xs text-muted">Up to 10 MB, 50,000 rows.</p>
          </div>
        </div>
      )}

      {step === "columns" && columnMapping && parsedCsv && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Which column holds each field? {formatCount(parsedCsv.rows.length, "row")} found.
            </p>
            {source !== "unknown" && (
              <div className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="text-sm font-medium">Looks like a {IMPORT_SOURCE_LABELS[source]}</p>
                <p className="mt-1 text-xs text-muted">
                  Columns were mapped automatically. Check them below. {SOURCE_NOTES[source]}
                </p>
              </div>
            )}
            {parsedCsv.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-warning">
                {parsedCsv.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            )}
          </div>

          <section className="flex flex-col gap-4 border-t border-separator pt-4">
            <Eyebrow>Required</Eyebrow>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {COLUMN_FIELDS.filter((f) => REQUIRED_COLUMN_KEYS.includes(f.key)).map(renderColumnField)}
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-separator pt-4">
            <Eyebrow>Optional</Eyebrow>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {COLUMN_FIELDS.filter((f) => !REQUIRED_COLUMN_KEYS.includes(f.key)).map(renderColumnField)}
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-separator pt-4">
            <div>
              <Eyebrow>Location hints</Eyebrow>
              <p className="mt-1 text-xs text-muted">
                Columns that roughly place a climb, such as a country, state, or boulder. They
                only break ties between climbs that share a name.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {headers
                .filter((header) => !mappedHeaders.has(header))
                .map((header) => {
                  const selected = columnMapping.areaHints.includes(header);
                  return (
                    <button
                      key={header}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setColumnMapping({
                          ...columnMapping,
                          areaHints: selected
                            ? columnMapping.areaHints.filter((h) => h !== header)
                            : [...columnMapping.areaHints, header],
                        })
                      }
                      className={choicePillClass(selected, "bg-surface text-foreground")}
                    >
                      {header}
                    </button>
                  );
                })}
              {headers.every((header) => mappedHeaders.has(header)) && (
                <p className="text-xs text-muted">Every column is already mapped to a field.</p>
              )}
            </div>
          </section>

          <div className="flex gap-4">
            <Button variant="ghost" onPress={() => goBack("upload")}>
              Back
            </Button>
            <Button onPress={handleColumnsNext}>Next: Values</Button>
          </div>
        </div>
      )}

      {step === "values" && (
        <div className="flex flex-col gap-6">
          <ValueMappingSection
            title="Ascent style"
            values={ascentStyleValues}
            mapping={ascentStyleMapping}
            onChange={setAscentStyleMapping}
            options={ASCENT_STYLE_OPTIONS}
            skipLabel="Skip these rows"
          />

          <ValueMappingSection
            title="Climb type"
            description="Only used to tell same-named climbs apart."
            values={climbTypeValues}
            mapping={climbTypeMapping}
            onChange={setClimbTypeMapping}
            options={CLIMB_TYPE_OPTIONS}
            skipLabel="Ignore"
          />

          <ValueMappingSection
            title="Grade feel"
            values={gradeFeelValues}
            mapping={gradeFeelMapping}
            onChange={setGradeFeelMapping}
            options={GRADE_FEEL_OPTIONS}
            skipLabel="Ignore (use solid)"
          />

          {columnMapping?.date && (
            <section className="flex flex-col gap-3">
              <Eyebrow>Dates</Eyebrow>
              {/* Only asked when the file is genuinely ambiguous. A column of
                  "2019-10-15" or "Sun Sep 22 2019" reads the same way under
                  every option, and offering a choice that changes nothing
                  reads as "your dates aren't supported". */}
              {needsDateFormat ? (
                <>
                  <TextField>
                    <Label>Date format</Label>
                    <OptionSelect
                      ariaLabel="Date format"
                      value={dateFormat}
                      onChange={setDateFormat}
                      options={DATE_FORMAT_OPTIONS}
                    />
                  </TextField>
                  <p className="text-xs text-muted">
                    This file has all-numeric dates, so 05/06/2019 could be May 6th or June 5th.
                    Pick the order the file uses.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  Dates in this column are unambiguous and are read automatically.
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
              {placeholderDates.length > 0 && (
                <Checkbox isSelected={dropPlaceholderDates} onChange={setDropPlaceholderDates}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-sm">
                      Import the {formatCount(placeholderRowCount, "row")} dated “
                      {placeholderDates[0].value}” without a date.
                      <span className="block text-xs text-muted">
                        These rows share one exact timestamp
                        {source === "kaya"
                          ? ". KAYA fills in the export time for sends logged without a date."
                          : ", which is usually the export time standing in for a missing date."}
                      </span>
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              )}
            </section>
          )}

          {(columnMapping?.grade || columnMapping?.suggestedGrade) && (
            <section className="flex flex-col gap-3">
              <Eyebrow>Grades</Eyebrow>
              <TextField>
                <Label>Grade notation</Label>
                <OptionSelect
                  ariaLabel="Grade notation"
                  value={gradeScale}
                  onChange={setGradeScale}
                  options={GRADE_SCALE_OPTIONS}
                />
              </TextField>
            </section>
          )}

          <div className="flex gap-4">
            <Button variant="ghost" onPress={() => goBack("columns")}>
              Back
            </Button>
            <Button onPress={handleValuesNext}>Next: Climbs</Button>
          </div>
        </div>
      )}

      {step === "match" && normalized && (
        <div className="flex flex-col gap-6">
          {autoMapped && source !== "unknown" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Recognized as a {IMPORT_SOURCE_LABELS[source]}: columns and values were mapped
                automatically
                {gradeScale === "converted" && ", with grades read as Font / French"}.{" "}
                <button
                  type="button"
                  onClick={() => goBack("columns")}
                  className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-foreground"
                >
                  Adjust the mapping
                </button>
              </p>
              {/* The columns step would have shown these; this path skipped it. */}
              {parsedCsv && parsedCsv.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs text-warning">
                  {parsedCsv.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ImportMatchStep
            resolved={resolved}
            lookup={lookup}
            onRetryLookup={() => void runLookup(normalized.valid, gradeScale)}
            preferredAreas={preferredAreas}
            onPreferredAreasChange={setPreferredAreas}
            filter={matchFilter}
            onFilterChange={setMatchFilter}
            onChoose={(rowIndex, choice) => applyChoices([{ rowIndex, choice }])}
            onChooseMany={applyChoices}
          />
          <div className="flex gap-4">
            <Button variant="ghost" onPress={() => goBack("values")}>
              Back
            </Button>
            <Button onPress={handleMatchNext} isDisabled={resolved === null}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {step === "review" && normalized && resolved && summary && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Will import" value={summary.ready} />
            <Stat
              label="Unmatched"
              value={summary.attention}
              tone={summary.attention > 0 ? "warning" : undefined}
            />
            <Stat label="Skipped" value={summary.skipped} />
            <Stat
              label="Can't import"
              value={normalized.invalid.length}
              tone={normalized.invalid.length > 0 ? "danger" : undefined}
            />
          </div>

          {summary.attention > 0 && (
            <p className="text-sm text-muted">
              {formatCount(summary.attention, "row")} {summary.attention === 1 ? "has" : "have"} no
              matching climb and will be skipped.{" "}
              <button
                type="button"
                onClick={() => {
                  setMatchFilter("attention");
                  goBack("match");
                }}
                className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-foreground"
              >
                Back to matching
              </button>
            </p>
          )}

          {summary.review > 0 && (
            <p className="text-sm text-muted">
              {formatCount(summary.review, "row")} {summary.review === 1 ? "was" : "were"} matched
              by inference from the file&apos;s hints and grades, not by name alone.{" "}
              <button
                type="button"
                onClick={() => {
                  setMatchFilter("review");
                  goBack("match");
                }}
                className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-foreground"
              >
                Check them
              </button>
            </p>
          )}

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
              <ProgressBar value={progress.completed} max={progress.total} />
              <p className="text-xs text-muted">
                {progress.imported} imported &middot;{" "}
                {onConflict === "overwrite" && <>{progress.overwritten} overwritten &middot; </>}
                {progress.alreadyLogged} already logged &middot; {progress.failed} failed
              </p>
              {progress.lastError && (
                <p className="text-xs text-danger">
                  {progress.failed} {progress.failed === 1 ? "row has" : "rows have"} failed so
                  far. Latest error: {progress.lastError}
                </p>
              )}
              <div>
                <Button variant="ghost" onPress={handleCancel} isDisabled={cancelRequested}>
                  {cancelRequested ? "Stopping after the current batch…" : "Cancel import"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <TextField>
                <Label>Already-logged climbs</Label>
                <SegmentedButtons
                  value={onConflict}
                  onChange={setOnConflict}
                  options={CONFLICT_MODES}
                  className="lg:w-auto lg:self-start"
                />
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
                <Button variant="ghost" onPress={() => goBack("match")}>
                  Back
                </Button>
                <Button onPress={handleFinalize} isDisabled={summary.ready === 0}>
                  Import {formatCount(summary.ready, "send")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "result" && importResult && (
        <div className="flex flex-col gap-6">
          {importResult.stopped && (
            <p className="text-sm text-danger">
              {importResult.stopped.message} Rows imported before it stopped were kept.
            </p>
          )}

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Imported" value={importResult.imported} />
            {importResult.overwritten > 0 && (
              <Stat label="Replaced" value={importResult.overwritten} />
            )}
            <Stat label="Already logged" value={importResult.alreadyLogged} />
            <Stat
              label="Not imported"
              value={failures.length}
              tone={failures.length > 0 ? "warning" : undefined}
            />
          </div>

          {failures.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-foreground">
                View rows that weren&apos;t imported
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                {failures.slice(0, MAX_LISTED_FAILURES).map((item) => (
                  <li key={`${item.rowIndex}-${item.reason}`}>
                    Row {item.rowIndex + 1}
                    {item.label ? ` (${item.label})` : ""}: {item.reason}
                  </li>
                ))}
                {failures.length > MAX_LISTED_FAILURES && (
                  <li>
                    …and {failures.length - MAX_LISTED_FAILURES} more. Download the CSV below for
                    the full list.
                  </li>
                )}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {importResult.imported + importResult.overwritten > 0 && (
              <AppLink href={profileHref} className="text-sm">
                See your sends
              </AppLink>
            )}
            {failures.length > 0 && (
              <Button variant="ghost" onPress={handleDownloadFailedRows}>
                Download failed rows (CSV)
              </Button>
            )}
            <Button onPress={reset}>Import another file</Button>
          </div>
        </div>
      )}
    </div>
  );
}
