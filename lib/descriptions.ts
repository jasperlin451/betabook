export function missingDescriptionMessage(kind: "area" | "climb"): string {
  return `This ${kind} is missing a description. Please add more detailed information.`;
}
