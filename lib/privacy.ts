import { ActionError } from "@/lib/action-result";

export const SHARING_AUDIENCES = [
  { value: "private", label: "Only me" },
  { value: "friends", label: "Friends" },
  { value: "public", label: "Public" },
] as const;

export type SharingAudience = (typeof SHARING_AUDIENCES)[number]["value"];

export function parseSharingAudience(value: unknown): SharingAudience {
  const audience = SHARING_AUDIENCES.find((option) => option.value === value);
  if (!audience) throw new ActionError("Invalid sharing audience");
  return audience.value;
}
