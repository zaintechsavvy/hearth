import type { ActivityEntry } from "@/lib/activity-types";

/** Someone sitting in a room keeps an occupancy or motion sensor firing; one line every quarter of an hour is enough. */
const PRESENCE = new Set(["noticed motion", "noticed someone"]);
const PRESENCE_GAP_MS = 15 * 60_000;
/** Changes this close together, alike and by the same hand, happened as one: a scene, a group, or Good night. */
const TOGETHER_MS = 5000;

/** Back and forth on the same devices this close together is one stretch of fiddling, told as one line. */
const REPEAT_GAP_MS = 10 * 60_000;
const REPEATS = 2;
/** One level set in steps, a thermostat nudged up three times, with each step this close to the last, is told as one change. */
const STEPS_GAP_MS = 60_000;
const SET_TO = /^was set to (-?\d+(?:\.\d+)?)(°\w*|%)$/;

/**
 * A device unreachable for less than this was only dozing or between polls, as HomeKit accessories often are, so
 * neither its going offline nor its coming back is told.
 */
const OFFLINE_MS = 10 * 60_000;

/** Changes that undo each other, and how a stretch of them reads: "turned on and off". */
const PAIRS = [["turned on", "turned off", "turned on and off"], ["opened", "closed", "opened and closed"], ["locked", "unlocked", "locked and unlocked"]] as const;

/** Wording that reads the same for one device or several: "turned on", not "was armed". */
const sharesWords = (what: string) => !/^(was|is|has) /.test(what) && what !== "rang";

const names = (list: string[]) => list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;

/**
 * What Activity shows: nothing from a muted device, no outage shorter than ten minutes, presence sensors at most once a quarter of an hour each,
 * devices that changed together in one line, "Floor lamp and Pendants turned on", and the same devices switched back
 * and forth in one line that opens to show each time, "Floor lamp and Pendants turned on and off 4 times".
 */
export function settle(entries: ActivityEntry[], muted: ReadonlySet<string>, now = Date.now()) {
  const lastShown = new Map<string, number>();
  const kept = outages([...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), now).filter(entry => {
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
  return repeats(steps(merged)).reverse();
}

/**
 * Lines, oldest first, without brief outages: a device's "went offline" is dropped when its next line comes within
 * `OFFLINE_MS`, or when none has come yet and it went offline less than that ago, and a "came back online" is dropped
 * when the outage it ends was dropped.
 */
function outages(lines: ActivityEntry[], now: number) {
  const dropped = new Set<ActivityEntry>();
  const open = new Map<string, ActivityEntry>();
  for (const line of lines) {
    if (!line.deviceId) continue;
    const offline = open.get(line.deviceId);
    if (offline) {
      open.delete(line.deviceId);
      if (Date.parse(line.at) - Date.parse(offline.at) < OFFLINE_MS) {
        dropped.add(offline);
        if (line.what === "came back online") dropped.add(line);
      }
    }
    if (line.what === "went offline") open.set(line.deviceId, line);
  }
  for (const offline of open.values()) if (now - Date.parse(offline.at) < OFFLINE_MS) dropped.add(offline);
  return lines.filter(line => !dropped.has(line));
}

/**
 * Lines, oldest first, with each run of one device set to a new level step by step folded into one line from the
 * level before the first step to the last: "was set from 25° to 26.5°C". The first step's own start is one step back.
 */
function steps(lines: ActivityEntry[]) {
  const out: ActivityEntry[] = [];
  let run: ActivityEntry[] = [];
  const flush = () => {
    if (run.length < 2) out.push(...run);
    else {
      const values = run.map(line => Number(SET_TO.exec(line.what)![1]));
      const step = values[1] - values[0];
      const steady = step !== 0 && values.every((value, index) => index === 0 || Math.abs(value - values[index - 1] - step) < 1e-9);
      const unit = SET_TO.exec(run[run.length - 1].what)![2];
      const latest = run[run.length - 1];
      const from = steady ? `${Math.round((values[0] - step) * 10) / 10}${unit === "%" ? "%" : "°"} ` : "";
      out.push({ ...latest, id: `steps:${run[0].id}`, what: steady ? `was set from ${from}to ${values[values.length - 1]}${unit}` : latest.what, group: [...run].reverse() });
    }
    run = [];
  };
  for (const line of lines) {
    const last = run[run.length - 1];
    const joins = last && SET_TO.test(line.what) && line.deviceId && line.deviceId === last.deviceId && !line.deviceIds && line.by === last.by
      && (line.via ?? null) === (last.via ?? null) && Date.parse(line.at) - Date.parse(last.at) <= STEPS_GAP_MS;
    if (!joins) {
      flush();
      if (SET_TO.test(line.what) && line.deviceId && !line.deviceIds) { run = [line]; continue; }
      out.push(line);
      continue;
    }
    run.push(line);
  }
  flush();
  return out;
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
    return [{ ...latest, id: `repeat:${run[0].id}`, what: both && run.length === 2 ? pair[2] : `${both ? pair[2] : latest.what} ${run.length} times`, tone, group: [...run].reverse() } satisfies ActivityEntry];
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
