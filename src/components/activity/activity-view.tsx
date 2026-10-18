"use client";

import { BellRing, Cpu, DoorOpen, Droplets, Flame, History, Lightbulb, Lock, LockOpen, Thermometer, Workflow, type LucideIcon } from "lucide-react";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { TILE_ICON_COMPONENTS } from "@/components/dashboard/tiles/tile-icons";
import type { ActivityCategory, ActivityEntry } from "@/lib/activity-types";
import { defaultStyle } from "@/lib/dashboard/style";
import type { Device } from "@/lib/devices/types";
import styles from "./activity-view.module.css";

type Page = { entries: ActivityEntry[]; more: boolean; next?: string; missing?: string[] };
const ALL = "all";
const ANY_ROOM = "__any";
const FILTERS: { value: ActivityCategory | typeof ALL; label: string }[] = [
  { value: ALL, label: "Everything" }, { value: "doors", label: "Doors and locks" }, { value: "lights", label: "Lights" },
  { value: "sensors", label: "Sensors" }, { value: "climate", label: "Climate" }, { value: "automations", label: "Automations" }, { value: "system", label: "System" },
];
const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = { doors: DoorOpen, lights: Lightbulb, sensors: BellRing, climate: Thermometer, household: History, automations: Workflow, system: Cpu };

/** The device's own icon where Hearth knows the device, so a television reads as one; otherwise one for what happened. */
function iconFor(entry: ActivityEntry, devices: Map<string, Device>): LucideIcon {
  if (entry.what === "unlocked") return LockOpen;
  if (entry.what === "locked" || entry.what === "jammed") return Lock;
  if (entry.what.includes("leak") || entry.what === "is dry again") return Droplets;
  if (entry.what.includes("smoke")) return Flame;
  if (entry.what === "rang") return BellRing;
  const device = entry.deviceId ? devices.get(entry.deviceId) : undefined;
  return device ? TILE_ICON_COMPONENTS[defaultStyle(device).icon] : CATEGORY_ICONS[entry.category];
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const fetchPage = async (url: string): Promise<Page> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("The activity log is unavailable.");
  return response.json();
};

/** Everything that happened at home, newest first, grouped by day, with who did it when Hearth knows. */
export function ActivityView() {
  const { home } = useHome();
  const [category, setCategory] = useState<string>(ALL);
  const [room, setRoom] = useState<string>(ANY_ROOM);
  const query = (before?: string) => {
    const params = new URLSearchParams();
    if (category !== ALL) params.set("category", category);
    if (room !== ANY_ROOM) params.set("room", room);
    if (before) params.set("before", before);
    return `/api/activity?${params}`;
  };
  const { data, error, size, setSize, isLoading, mutate } = useSWRInfinite<Page>(
    (index, previous: Page | null) => index === 0 ? query() : previous?.more ? query(previous.next ?? previous.entries.at(-1)?.at) : null,
    fetchPage,
    { refreshInterval: 30_000, revalidateFirstPage: true },
  );
  const entries = data?.flatMap(page => page.entries) ?? [];
  const devices = new Map((home?.devices ?? []).map(device => [device.id, device]));
  const more = data?.at(-1)?.more ?? false;
  const missing = [...new Set(data?.flatMap(page => page.missing ?? []) ?? [])];
  const days = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = new Date(entry.at).toDateString();
    days.set(key, [...(days.get(key) ?? []), entry]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header} data-on-wall>
        <h1 className={styles.title}>Activity</h1>
        <p className={styles.lede}>What happened at home, and who did it.</p>
      </header>
      <div className={styles.filters} role="group" aria-label="Show">
        <DropdownMenu label={FILTERS.find(filter => filter.value === category)?.label ?? "Everything"} items={FILTERS.map(filter => ({ label: filter.label, onSelect: () => setCategory(filter.value) }))} />
        {home && home.rooms.length > 0 && (
          <DropdownMenu label={room === ANY_ROOM ? "Every room" : room} items={[{ label: "Every room", onSelect: () => setRoom(ANY_ROOM) }, ...home.rooms.map(value => ({ label: value, onSelect: () => setRoom(value) }))]} />
        )}
      </div>
      {missing.length > 0 && (
        <Glass shape="panel" className={styles.notice} role="status">
          <span>{missing.join(" and ")} did not send {missing.length === 1 ? "its" : "their"} history in time, so changes made outside Hearth may be missing.</span>
          <Button size="sm" variant="ghost" onClick={() => void mutate()}>Try again</Button>
        </Glass>
      )}
      {isLoading && !data ? (
        <Glass shape="panel" className={styles.group}><Skeleton lines={5} label="Loading activity" /></Glass>
      ) : error ? (
        <Glass shape="panel" className={styles.group}><p className={styles.lede}>{error.message}</p></Glass>
      ) : entries.length === 0 ? (
        <Glass shape="panel" className={styles.empty}>
          <EmptyState icon={<History size={24} strokeWidth={1.75} />} title="Nothing yet" description="Unlock a door, switch a light, or open the garage, and it shows up here." />
        </Glass>
      ) : (
        [...days].map(([key, list]) => (
          <section key={key} className={styles.day} aria-label={dayLabel(new Date(key))}>
            <h2 className={styles.dayTitle} data-on-wall>{dayLabel(new Date(key))}</h2>
            <Glass shape="panel" className={styles.group}>
              <ol className={styles.list}>
                {list.map(entry => {
                  const Icon = iconFor(entry, devices);
                  return (
                    <li key={entry.id} className={styles.entry} data-tone={entry.tone} data-picture={entry.picture ? "" : undefined}>
                      <Icon className={styles.icon} size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.text}>
                        <span><b>{entry.name}</b> {entry.what}</span>
                        {(entry.room || entry.by || entry.via) && <span className={styles.meta}>{[entry.room, entry.by && `by ${entry.by}`, entry.via].filter(Boolean).join(" · ")}</span>}
                      </span>
                      {entry.picture && (
                        <a className={styles.picture} href={entry.picture} target="_blank" rel="noreferrer" aria-label={`Picture from when ${entry.name} rang`}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated camera picture that must bypass the image optimiser */}
                          <img src={entry.picture} alt="" loading="lazy" />
                        </a>
                      )}
                      <time className={styles.time} dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                    </li>
                  );
                })}
              </ol>
            </Glass>
          </section>
        ))
      )}
      {more && <Button variant="secondary" className={styles.more} onClick={() => void setSize(size + 1)}>Show earlier</Button>}
    </div>
  );
}
