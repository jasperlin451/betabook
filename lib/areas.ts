export type AreaInput = {
  name: string;
  description: string | null;
};

export type RawAreaInput = {
  name: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
};

export function validateAreaInput(raw: RawAreaInput): AreaInput {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    throw new Error("Name is required");
  }

  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : null;

  return { name, description };
}
