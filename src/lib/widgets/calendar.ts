import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { unseal } from "@/lib/crypto";
import type { TileColor } from "@/lib/dashboard/layout";
import { db } from "@/lib/db";
import { calendar } from "@/lib/db/schema";
import { readableError } from "@/lib/home";
import { IntegrationError } from "@/lib/integrations/types";
import { eventsBetween, type CalendarEvent } from "./ical";

export type { CalendarEvent } from "./ical";

export interface CalendarSummary {
  id: string;
  name: string;
  color: TileColor;
}

export interface Agenda {
  calendars: CalendarSummary[];
  events: CalendarEvent[];
  errors: { calendarId: string; message: string }[];
}

const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 8 * 1024 * 1024;
const WINDOW_DAYS = 14;
const MAX_EVENTS = 200;

const registry = globalThis as unknown as { hearthCalendars?: Map<string, { at: number; url: string; text: string }> };
const cache = registry.hearthCalendars ??= new Map();

/** `webcal://` is how Apple and Outlook share feeds; it is plain HTTPS underneath. */
export const feedUrl = (url: string) => url.trim().replace(/^webcals?:\/\//i, "https://");

export async function fetchFeed(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { accept: "text/calendar" } });
  } catch {
    throw new IntegrationError("Could not reach that calendar address.");
  }
  if (response.status === 404 || response.status === 403 || response.status === 401) throw new IntegrationError("That calendar address was refused. Copy the secret address again; resetting it in Google Calendar makes the old one stop working.");
  if (!response.ok) throw new IntegrationError(`The calendar answered with ${response.status}.`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new IntegrationError("That calendar is too large to read.");
  const text = await response.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new IntegrationError("That address is not an iCal feed. In Google Calendar, use the secret address in iCal format.");
  return text;
}

async function feedText(id: string, url: string) {
  const hit = cache.get(id);
  if (hit && hit.url === url && Date.now() - hit.at < CACHE_MS) return hit.text;
  const text = await fetchFeed(url);
  cache.set(id, { at: Date.now(), url, text });
  return text;
}

export const forgetCalendar = (id: string) => cache.delete(id);

const sortKey = (event: CalendarEvent) => event.allDay ? `${event.start}T00:00:00.000Z` : event.start;

/** The next two weeks across someone's calendars, or the ones named. A calendar that fails is reported, not fatal. */
export async function agendaFor(userId: string, ids?: string[]): Promise<Agenda> {
  const rows = await db.select().from(calendar)
    .where(ids?.length ? and(eq(calendar.userId, userId), inArray(calendar.id, ids)) : eq(calendar.userId, userId))
    .orderBy(calendar.createdAt);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
  const errors: Agenda["errors"] = [];
  const lists = await Promise.all(rows.map(async row => {
    try {
      return eventsBetween(await feedText(row.id, unseal<string>(row.url)), row.id, from, to);
    } catch (error) {
      errors.push({ calendarId: row.id, message: readableError(error) });
      return [];
    }
  }));
  const now = Date.now();
  const events = lists.flat()
    .filter(event => event.allDay || new Date(event.end).getTime() > now)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .slice(0, MAX_EVENTS);
  return { calendars: rows.map(row => ({ id: row.id, name: row.name, color: row.color })), events, errors };
}
