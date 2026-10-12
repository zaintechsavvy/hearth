/** How long after a command a matching change is credited to whoever sent it. */
const WINDOW_MS = 20_000;

const registry = globalThis as unknown as { hearthAttribution?: Map<string, { by: string; at: number }> };
const recent = registry.hearthAttribution ??= new Map();

/** Remembers who just sent a device a command, so the activity log can say "by Sam" or "by the Evening scene". */
export function noteCommand(userId: string, deviceId: string, by: string) {
  recent.set(`${userId}:${deviceId}`, { by, at: Date.now() });
}

export function creditFor(userId: string, deviceId: string, at: number) {
  const entry = recent.get(`${userId}:${deviceId}`);
  if (!entry || at - entry.at > WINDOW_MS) return null;
  recent.delete(`${userId}:${deviceId}`);
  return entry.by;
}
