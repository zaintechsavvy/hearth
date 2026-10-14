import "server-only";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { logbookChange } from "@/lib/activity-diff";
import type { ActivityCategory, ActivityEntry } from "@/lib/activity-types";
import { db } from "@/lib/db";
import { activity, integration } from "@/lib/db/schema";
import { deviceId, type Device } from "@/lib/devices/types";
import { loadHome } from "@/lib/home";
import { createProvider } from "@/lib/integrations/registry";
import type { Provider } from "@/lib/integrations/types";

const PAGE = 80;
/** Each page with an integration's logbook covers this much time, so a busy home never sends days of entries at once. */
const WINDOW_MS = 12 * 3_600_000;
/** How far back an integration's logbook is asked about: Home Assistant keeps ten days by default. */
const LOGBOOK_DAYS = 10;
/** An integration's entry this close to one Hearth logged for the same device is the same change, and Hearth's says who. */
const SAME_CHANGE_MS = 20_000;
const LOGBOOK_TIMEOUT_MS = 8000;
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
    return { entries: page.map(row => ({ ...row, at: row.at.toISOString() })), more: page.length === PAGE };
  }

  const home = await loadHome(homeId);
  const devices = new Map(home.devices.map(device => [device.id, device]));
  let to = filter.before ?? new Date();
  for (let window = 1; ; window++) {
    const page = await windowPage(filters, sources, devices, { category, room }, to);
    if (page.entries.length || !page.more || window === MAX_WINDOWS) return page;
    to = new Date(page.next!);
  }
}

async function windowPage(filters: SQL[], sources: { row: typeof integration.$inferSelect; provider: Provider }[], devices: Map<string, Device>, { category, room }: Omit<Filter, "before">, to: Date): Promise<ActivityPage> {
  let from = new Date(to.getTime() - WINDOW_MS);
  const page = await db.select().from(activity).where(and(...filters, lt(activity.at, to), gte(activity.at, from))).orderBy(desc(activity.at)).limit(PAGE * 4);
  if (page.length === PAGE * 4) from = page[page.length - 1].at;

  const logged = await Promise.all(sources.map(async ({ row, provider }) => {
    try {
      const entries = await Promise.race([provider.logbook!(from, to), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), LOGBOOK_TIMEOUT_MS))]);
      return entries.map((entry, index): ActivityEntry => {
        const id = entry.nativeId ? deviceId(row.id, entry.nativeId) : null;
        const device = id ? devices.get(id) : undefined;
        const change = logbookChange(device, entry.nativeId, entry.what);
        return { id: `${row.id}:${entry.at.getTime()}:${index}`, at: entry.at.toISOString(), deviceId: device ? id : null, name: device?.name ?? entry.name, room: device?.room ?? null, by: entry.by, ...change };
      });
    } catch {
      return [];
    }
  }));

  const mine: ActivityEntry[] = page.map(row => ({ ...row, at: row.at.toISOString() }));
  const theirs = logged.flat().filter(entry => {
    const time = Date.parse(entry.at);
    if (time < from.getTime() || time >= to.getTime()) return false;
    if ((category && entry.category !== category) || (room && entry.room !== room)) return false;
    return !mine.some(own => own.deviceId !== null && own.deviceId === entry.deviceId && Math.abs(Date.parse(own.at) - time) < SAME_CHANGE_MS);
  });
  const entries = [...mine, ...theirs].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const older = await db.select({ at: activity.at }).from(activity).where(and(...filters, lt(activity.at, from))).limit(1);
  const more = older.length > 0 || from.getTime() > Date.now() - LOGBOOK_DAYS * 86_400_000;
  return { entries, more, next: from.toISOString() };
}
