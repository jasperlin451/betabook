/** Compact, deterministic initials for profile-photo fallbacks. Names with
 * multiple words use the outside pair (so middle names do not crowd the
 * avatar); a single-word name uses its first two characters. */
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";

  const first = Array.from(parts[0]);
  const initials =
    parts.length === 1
      ? first.slice(0, 2).join("")
      : `${first[0] ?? ""}${Array.from(parts.at(-1) ?? "")[0] ?? ""}`;

  return initials.toUpperCase();
}

/** Only pass the Google profile-photo URLs the app is configured to optimize
 * to next/image. Better Auth's field is nullable but older/local rows may
 * contain placeholders or malformed values; those should use initials. */
export function getGoogleProfileImageUrl(image?: string | null): string | null {
  if (!image) return null;

  try {
    const url = new URL(image);
    if (url.protocol !== "https:" || url.hostname !== "lh3.googleusercontent.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}
