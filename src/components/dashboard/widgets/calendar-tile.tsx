"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Agenda, CalendarEvent } from "@/lib/widgets/calendar";
import styles from "./calendar-tile.module.css";
import { useMinute } from "./use-minute";

const REFRESH_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

const fetchAgenda = async (url: string): Promise<Agenda> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Your calendar is unavailable.");
  return response.json();
};

const dayKey = (event: CalendarEvent) => event.allDay ? event.start : localDate(new Date(event.start));
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function dayLabel(key: string, now: number) {
  if (key === localDate(new Date(now))) return "Today";
  if (key === localDate(new Date(now + DAY_MS))) return "Tomorrow";
  return new Date(`${key}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

const byStart = (a: CalendarEvent, b: CalendarEvent) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start);

const timeOf = (event: CalendarEvent) => event.allDay ? "All day" : new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The next two weeks from the calendars someone added in Settings, grouped by day. */
export function CalendarTile({ tile }: { tile: TileConfig }) {
  const ids = tile.options?.calendars?.join(",");
  const { data, error } = useSWR<Agenda>(`/api/calendar${ids ? `?ids=${ids}` : ""}`, fetchAgenda, { refreshInterval: REFRESH_MS });
  const now = useMinute();

  if (error) return <div className={`${glassClass("panel")} ${styles.tile} ${styles.center}`}><span className={styles.muted}>{error.message}</span></div>;
  if (!data || now === null) return <div className={`${glassClass("panel")} ${styles.tile}`}><Skeleton lines={3} label="Loading your calendar" /></div>;
  if (data.calendars.length === 0) {
    return (
      <Link href="/settings#calendars" className={`${glassClass("panel")} ${styles.tile} ${styles.center} ${styles.setup}`}>
        <CalendarPlus size={22} strokeWidth={1.75} aria-hidden="true" />
        <span>Connect a calendar</span>
        <span className={styles.muted}>Google Calendar or any iCal address</span>
      </Link>
    );
  }

  const colors = new Map(data.calendars.map(calendar => [calendar.id, calendar.color]));
  const days = new Map<string, CalendarEvent[]>();
  for (const event of data.events) days.set(dayKey(event), [...(days.get(dayKey(event)) ?? []), event]);
  const ordered = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([key, events]) => [key, events.sort(byStart)] as const);
  const failed = data.errors.length > 0;

  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Calendar">
      <header className={styles.header}>
        <span className={styles.today}>{new Date(now).toLocaleDateString(undefined, { weekday: "long" })}</span>
        <span className={styles.date}>{new Date(now).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span>
      </header>
      {failed && <p className={styles.warning}>{data.errors.length === data.calendars.length ? data.errors[0].message : "One calendar could not be read."}</p>}
      {days.size === 0 ? (
        <p className={styles.free}>Nothing in the next two weeks.</p>
      ) : (
        <div className={styles.agenda}>
          {ordered.map(([key, events]) => (
            <section key={key} className={styles.day} aria-label={dayLabel(key, now)}>
              <h3 className={styles.dayLabel}>{dayLabel(key, now)}</h3>
              <ul className={styles.events}>
                {events.map(event => (
                  <li key={event.id} className={styles.event} data-color={colors.get(event.calendarId)} data-now={!event.allDay && new Date(event.start).getTime() <= now || undefined}>
                    <span className={styles.time}>{timeOf(event)}</span>
                    <span className={styles.title}>{event.title}</span>
                    {event.location && <span className={styles.location}>{event.location}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
