import type { ActivityEntry } from "@/lib/activity-types";

/** Someone sitting in a room keeps an occupancy or motion sensor firing; one line every quarter of an hour is enough. */
const PRESENCE = new Set(["noticed motion", "noticed someone"]);
const PRESENCE_GAP_MS = 15 * 60_000;
/** Changes this close together, alike and by the same hand, happened as one: a scene, a group, or Good night. */
const TOGETHER_MS = 5000;

/** Wording that reads the same for one device or several: "turned on", not "was armed". */
const sharesWords = (what: string) => !/^(was|is|has) /.test(what) && what !== "rang";

const names = (list: string[]) => list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;

/**
 * What Activity shows: nothing from a muted device, presence sensors at most once a quarter of an hour each, and
 * devices that changed together in one line, "Floor lamp and Pendants turned on".
 */
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
  const merged: ActivityEntry[] = [];
  const named: string[][] = [];
  for (const entry of kept) {
    const group = merged.at(-1);
    const ids = group?.deviceIds ?? (group?.deviceId ? [group.deviceId] : []);
    const together = group && entry.deviceId && group.deviceId && !ids.includes(entry.deviceId) && !group.picture && !entry.picture
      && group.what === entry.what && sharesWords(entry.what) && group.by === entry.by && (group.via ?? null) === (entry.via ?? null)
      && Date.parse(entry.at) - Date.parse(group.at) <= TOGETHER_MS;
    if (!together) {
      merged.push(entry);
      named.push([entry.name]);
      continue;
    }
    const all = named[named.length - 1];
    all.push(entry.name);
    merged[merged.length - 1] = { ...group, name: names(all), room: group.room === entry.room ? group.room : null, deviceIds: [...ids, entry.deviceId as string], tone: group.tone === "info" ? entry.tone : group.tone };
  }
  return merged.reverse();
}
