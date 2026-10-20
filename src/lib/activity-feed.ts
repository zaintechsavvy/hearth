import "server-only";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { deviceWords, logbookChange } from "@/lib/activity-diff";
import { settle } from "@/lib/activity-settle";
import type { ActivityCategory, ActivityEntry } from "@/lib/activity-types";
import { db } from "@/lib/db";
import { activity, deviceOverride, integration } from "@/lib/db/schema";
import { deviceId, type Device } from "@/lib/devices/types";
import { loadHome } from "@/lib/home";
import { RING_MATCH_MS, ringPicturesBetween } from "@/lib/doorbell";
import { createProvider } from "@/lib/integrations/registry";
import type { LogbookEntry, Provider } from "@/lib/integrations/types";
import { isServerless } from "@/lib/setup-check";

const PAGE = 80;
/** Each page with an integration's logbook covers this much time, so a busy home never sends days of entries at once. */
const WINDOW_MS = 12 * 3_600_000;
/** How far back an integration's logbook is asked about: Home Assistant keeps ten days by default. */
const LOGBOOK_DAYS = 10;
/** An integration's entry this close to one Hearth logged for the same device is the same change, and Hearth's says who. */
const SAME_CHANGE_MS = 20_000;
/** A hosted Hearth reaches home over the internet, so it waits longer before saying the history did not load. */
const LOGBOOK_TIMEOUT_MS = isServerless() ? 15_000 : 8000;
/** Kinds whose changes are worth a line; readings are charted, and players and cameras change too often to read. */
const LOGGED_KINDS = new Set<Device["kind"]>(["light", "switch", "fan", "thermostat", "lock", "cover", "binary_sensor", "event", "scene", "person", "vacuum", "alarm"]);
/** Past windows do not change, so their logbook is kept a while instead of asked of Home Assistant on every refresh. */
const PAST_CACHE_MS = 10 * 60_000;
const past = new Map<string, { at: number; entries: LogbookEntry[] }>();

async function logbookFor(integrationId: string, provider: Provider, from: Date, to: Date, nativeIds: string[]) {
  const settled = to.getTime() < Date.now() - 60_000;
  const key = `${integrationId}:${from.getTime()}:${to.getTime()}`;
  const cached = settled ? past.get(key) : undefined;
  if (cached && Date.now() - cached.at < PAST_CACHE_MS) return cached.entries;
  const entries = await Promise.race([provider.logbook!(from, to, nativeIds), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), LOGBOOK_TIMEOUT_MS))]);
  if (settled) {
    past.set(key, { at: Date.now(), entries });
    for (const [stale, value] of past) if (Date.now() - value.at > PAST_CACHE_MS) past.delete(stale);
  }
  return entries;
}
/** Quiet windows skipped in one request before an empty page is returned. */
const MAX_WINDOWS = 6;

export interface ActivityPage {
  entries: ActivityEntry[];
  more: boolean;
  /** Where the next page starts, when it is not simply the last entry. */
  next?: string;
}

interface Filter {
  before: Date | null;
  category: ActivityCategory | null;
  room: string | null;
}

/** Hearth's own log merged with what each integration recorded itself, so changes made outside Hearth show too, even with no monitor running. */
export async function activityPage(homeId: string, filter: Filter): Promise<ActivityPage> {
  const { category, room } = filter;
  const filters = [eq(activity.userId, homeId)];
  if (category) filters.push(eq(activity.category, category));
  if (room) filters.push(eq(activity.room, room));
  const rows = await db.select().from(integration).where(eq(integration.userId, homeId));
  const sources = rows.map(row => ({ row, provider: createProvider(row) })).filter(source => source.provider.logbook);
  if (sources.length === 0) {
    const page = await db.select().from(activity).where(and(...filters, ...(filter.before ? [lt(activity.at, filter.before)] : []))).orderBy(desc(activity.at)).limit(PAGE);
    const known = page.some(row => !row.name) ? new Map((await loadHome(homeId)).devices.map(device => [device.id, device])) : new Map<string, Device>();
    const entries = page.map(row => {
      const device = row.deviceId ? known.get(row.deviceId) : undefined;
      return { ...row, at: row.at.toISOString(), name: row.name || device?.name || "A device", room: row.room ?? device?.room ?? null };
    });
    return { entries: await withPictures(homeId, settle(collapse(entries), await mutedDevices(homeId))), more: page.length === PAGE };
  }

  const home = await loadHome(homeId);
  const devices = new Map(home.devices.map(device => [device.id, device]));
  const muted = new Set(home.devices.filter(device => device.quiet).map(device => device.id));
  let to = filter.before ?? new Date();
  for (let window = 1; ; window++) {
    const page = await windowPage(filters, sources, devices, { category, room }, to);
    const entries = settle(page.entries, muted);
    if (entries.length || !page.more || window === MAX_WINDOWS) return { ...page, entries: await withPictures(homeId, entries) };
    to = new Date(page.next!);
  }
}

async function windowPage(filters: SQL[], sources: { row: typeof integration.$inferSelect; provider: Provider }[], devices: Map<string, Device>, { category, room }: Omit<Filter, "before">, to: Date): Promise<ActivityPage> {
  let from = new Date(to.getTime() - WINDOW_MS);
  const page = await db.select().from(activity).where(and(...filters, lt(activity.at, to), gte(activity.at, from))).orderBy(desc(activity.at)).limit(PAGE * 4);
  if (page.length === PAGE * 4) from = page[page.length - 1].at;

  const logged = await Promise.all(sources.map(async ({ row, provider }) => {
    const shown = [...devices.values()].filter(device => device.integrationId === row.id && LOGGED_KINDS.has(device.kind) && !device.auxiliary);
    const nativeIds = shown.map(device => device.id.slice(row.id.length + 1));
    try {
      // A hosted Hearth reaches home over the internet, where one slow answer is common; one more try before going without.
      const entries = await logbookFor(row.id, provider, from, to, nativeIds).catch(() => logbookFor(row.id, provider, from, to, nativeIds));
      return entries.flatMap((entry, index): ActivityEntry[] => {
        const id = entry.nativeId ? deviceId(row.id, entry.nativeId) : null;
        const device = id ? devices.get(id) : undefined;
        if (!device || !LOGGED_KINDS.has(device.kind) || device.auxiliary) return [];
        const what = device.kind === "event" ? (device.eventClass === "doorbell" ? "rang" : "was pressed") : deviceWords(device, entry.what);
        if (!what || what === "changed to unknown") return [];
        const change = logbookChange(device, entry.nativeId, what);
        return [{ id: `${row.id}:${entry.at.getTime()}:${index}`, at: entry.at.toISOString(), deviceId: id, name: device.name, room: device.room, by: entry.by, via: entry.via, ...change }];
      });
    } catch (error) {
      console.error(`Activity: ${row.name} did not send its logbook for ${from.toISOString()} to ${to.toISOString()}: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }));

  const theirsAll = logged.flat();
  const sameChange = (own: ActivityEntry, entry: ActivityEntry) => own.deviceId !== null && own.deviceId === entry.deviceId && Math.abs(Date.parse(own.at) - Date.parse(entry.at)) < SAME_CHANGE_MS;
  // A change Hearth noticed but did not make takes who and where from the integration's own record of it.
  const mine: ActivityEntry[] = collapse(page.map(row => {
    const device = row.deviceId ? devices.get(row.deviceId) : undefined;
    return { ...row, at: row.at.toISOString(), name: row.name || device?.name || "A device", room: row.room ?? device?.room ?? null };
  })).map(entry => {
    const match = entry.by ? undefined : theirsAll.find(other => sameChange(entry, other));
    return match ? { ...entry, by: match.by, via: match.via } : entry;
  });
  const theirs = theirsAll.filter(entry => {
    const time = Date.parse(entry.at);
    if (time < from.getTime() || time >= to.getTime()) return false;
    if ((category && entry.category !== category) || (room && entry.room !== room)) return false;
    return !mine.some(own => sameChange(own, entry));
  });
  const entries = [...mine, ...theirs].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const older = await db.select({ at: activity.at }).from(activity).where(and(...filters, lt(activity.at, from))).limit(1);
  const more = older.length > 0 || from.getTime() > Date.now() - LOGBOOK_DAYS * 86_400_000;
  return { entries, more, next: from.toISOString() };
}

async function mutedDevices(homeId: string) {
  const rows = await db.select({ deviceId: deviceOverride.deviceId }).from(deviceOverride).where(and(eq(deviceOverride.userId, homeId), eq(deviceOverride.quiet, true)));
  return new Set(rows.map(row => row.deviceId));
}

/** One change written down twice, by the command Hearth sent and by a screen that saw it happen, shows once, with who did it. */
function collapse(entries: ActivityEntry[]) {
  return entries.filter(entry => entry.by !== null || !entries.some(other => other !== entry && other.by !== null && other.deviceId !== null && other.deviceId === entry.deviceId && other.what === entry.what && Math.abs(Date.parse(other.at) - Date.parse(entry.at)) < SAME_CHANGE_MS));
}

/** Puts each doorbell ring's kept picture beside it. */
async function withPictures(homeId: string, entries: ActivityEntry[]): Promise<ActivityEntry[]> {
  const rings = entries.filter(entry => entry.deviceId && entry.what === "rang");
  if (rings.length === 0) return entries;
  const times = rings.map(entry => Date.parse(entry.at));
  const pictures = await ringPicturesBetween(homeId, new Date(Math.min(...times)), new Date(Math.max(...times)));
  if (pictures.length === 0) return entries;
  return entries.map(entry => {
    if (!entry.deviceId || entry.what !== "rang") return entry;
    const time = Date.parse(entry.at);
    const match = pictures.find(picture => picture.deviceId === entry.deviceId && Math.abs(picture.at.getTime() - time) < RING_MATCH_MS);
    return match ? { ...entry, picture: `/api/doorbell?id=${match.id}` } : entry;
  });
}
