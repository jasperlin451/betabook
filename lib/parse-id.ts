export function parseId(value: string | number): number | null {
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}
