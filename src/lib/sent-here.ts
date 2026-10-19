/** Devices this screen just changed, so a wall tablet does not announce what it did itself. */
const sent = new Map<string, number>();
const RECENT_MS = 30_000;

export function markSent(...deviceIds: string[]) {
  const now = Date.now();
  for (const id of deviceIds) sent.set(id, now);
}

export function sentHere(deviceId: string) {
  const at = sent.get(deviceId);
  return at !== undefined && Date.now() - at < RECENT_MS;
}
