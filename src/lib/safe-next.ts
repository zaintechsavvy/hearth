/** A path to return to after signing in. Only same-site paths count, so the link cannot send anyone elsewhere. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
