export default function AreaNotFound() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Area not found</h1>
      <p className="text-muted">
        We couldn&apos;t find an area with that id.
      </p>
    </div>
  );
}
