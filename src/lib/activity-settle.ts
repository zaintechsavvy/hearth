import type { ActivityEntry } from "@/lib/activity-types";

/** Someone sitting in a room keeps an occupancy or motion sensor firing; one line every quarter of an hour is enough. */
const PRESENCE = new Set(["noticed motion", "noticed someone"]);
const PRESENCE_GAP_MS = 15 * 60_000;

/** What Activity shows: nothing from a muted device, and presence sensors at most once a quarter of an hour each. */
export function settle(entries: ActivityEntry[], muted: ReadonlySet<string>) {
  const lastShown = new Map<string, number>();
  const kept = [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).filter(entry => {
    if (entry.deviceId && muted.has(entry.deviceId)) return false;
    if (!entry.deviceId || !PRESENCE.has(entry.what)) return true;
    const at = Date.parse(entry.at);
    const last = lastShown.get(entry.deviceId);
    if (last !== undefined && at - last < PRESENCE_GAP_MS) return false;
    lastShown.set(entry.deviceId, at);
    return true;
  });
  return kept.reverse();
}
