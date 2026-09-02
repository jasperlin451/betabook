/** The thin progress track the import wizard shows while a long job runs. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
      <div
        className="h-full bg-accent transition-all"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
  );
}
