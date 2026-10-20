import type { ActivityEntry } from "@/lib/activity-types";

/** Someone sitting in a room keeps an occupancy or motion sensor firing; one line every quarter of an hour is enough. */
const PRESENCE = new Set(["noticed motion", "noticed someone"]);
const PRESENCE_GAP_MS = 15 * 60_000;
/** Changes this close together, alike and by the same hand, happened as one: a scene, a group, or Good night. */
const TOGETHER_MS = 5000;

/** Back and forth on the same devices this close together is one stretch of fiddling, told as one line. */
const REPEAT_GAP_MS = 10 * 60_000;
const REPEATS = 3;
/** Changes that undo each other, and how a stretch of them reads: "turned on and off". */
const PAIRS = [["turned on", "turned off", "turned on and off"], ["opened", "closed", "opened and closed"], ["locked", "unlocked", "locked and unlocked"]] as const;

/** Wording that reads the same for one device or several: "turned on", not "was armed". */
const sharesWords = (what: string) => !/^(was|is|has) /.test(what) && what !== "rang";

const names = (list: string[]) => list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;

/**
 * What Activity shows: nothing from a muted device, presence sensors at most once a quarter of an hour each,
 * devices that changed together in one line, "Floor lamp and Pendants turned on", and the same devices switched back
 * and forth in one line that opens to show each time, "Floor lamp and Pendants turned on and off 4 times".
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
    const order = all.map((name, index) => ({ name, id: [...ids, entry.deviceId as string][index] })).sort((a, b) => a.name.localeCompare(b.name));
    merged[merged.length - 1] = { ...group, name: names(order.map(item => item.name)), room: group.room === entry.room ? group.room : null, deviceIds: order.map(item => item.id), tone: group.tone === "info" ? entry.tone : group.tone };
  }
  return repeats(merged).reverse();
}

/** Lines, oldest first, with each stretch of the same devices switched back and forth folded into one. */
function repeats(lines: ActivityEntry[]) {
  const pairOf = (what: string) => PAIRS.find(pair => pair[0] === what || pair[1] === what);
  const keyOf = (line: ActivityEntry) => {
    const pair = pairOf(line.what);
    const devices = line.deviceIds ?? (line.deviceId ? [line.deviceId] : null);
    return pair && devices && !line.picture ? `${devices.join("|")}#${pair[2]}#${line.by ?? ""}#${line.via ?? ""}` : null;
  };
  const runs: ActivityEntry[][] = [];
  const open = new Map<string, ActivityEntry[]>();
  for (const line of lines) {
    const key = keyOf(line);
    const run = key ? open.get(key) : undefined;
    if (key && run && Date.parse(line.at) - Date.parse(run[run.length - 1].at) <= REPEAT_GAP_MS) {
      run.push(line);
      continue;
    }
    const fresh = [line];
    runs.push(fresh);
    if (key) open.set(key, fresh);
  }
  return runs.flatMap(run => {
    if (run.length < REPEATS) return run;
    const latest = run[run.length - 1];
    const pair = pairOf(latest.what)!;
    const both = run.some(line => line.what !== latest.what);
    const tone = run.some(line => line.tone === "alert") ? "alert" : run.some(line => line.tone === "warning") ? "warning" : "info";
    return [{ ...latest, id: `repeat:${run[0].id}`, what: `${both ? pair[2] : latest.what} ${run.length} times`, tone, group: [...run].reverse() } satisfies ActivityEntry];
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
