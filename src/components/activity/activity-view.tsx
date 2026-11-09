"use client";

import { BellOff, BellRing, ChevronDown, History } from "lucide-react";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { useHome } from "@/components/dashboard/use-home";
import { Glass, glassClass } from "@/components/glass/glass";
import type { ActivityCategory, ActivityEntry } from "@/lib/activity-types";
import { updateDevice } from "@/lib/actions";
import { activityIcon, activityLit } from "./activity-icon";
import styles from "./activity-view.module.css";

type Page = { entries: ActivityEntry[]; more: boolean; next?: string; partial?: boolean };
const ALL = "all";
/** How long the chance to undo a mute stays on screen. */
const UNDO_MS = 6000;
const ANY_ROOM = "__any";
const FILTERS: { value: ActivityCategory | typeof ALL; label: string }[] = [
  { value: ALL, label: "Everything" }, { value: "doors", label: "Doors and locks" }, { value: "lights", label: "Lights" },
  { value: "sensors", label: "Sensors" }, { value: "climate", label: "Climate" }, { value: "automations", label: "Automations" }, { value: "system", label: "System" },
];

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
  const { mutate: mutateKey } = useSWRConfig();
  const muted = (home?.devices ?? []).filter(device => device.quiet);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setOpened(current => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const [undo, setUndo] = useState<{ deviceIds: string[]; name: string; quiet: boolean; at: number } | null>(null);
  const setQuiet = async (deviceIds: string[], quiet: boolean) => {
    await Promise.all(deviceIds.map(id => updateDevice(id, { quiet })));
    await Promise.all([mutate(), mutateKey("/api/home")]);
  };
  const changeQuiet = async (deviceIds: string[], name: string, quiet: boolean) => {
    await setQuiet(deviceIds, quiet);
    setUndo(previous => ({ deviceIds, name, quiet, at: (previous?.at ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);
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
        {muted.length > 0 && (
          <DropdownMenu icon={<BellOff size={15} strokeWidth={1.75} aria-hidden="true" />}
            label={`Muted: ${muted[0].name}${muted.length > 1 ? ` +${muted.length - 1}` : ""}`}
            items={muted.map(device => ({ label: `Show ${device.name} again`, icon: <BellRing size={15} strokeWidth={1.75} />, onSelect: () => void changeQuiet([device.id], device.name, false) }))} />
        )}
      </div>
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
            <h2 className={styles.dayTitle} data-on-wall data-wall-chip>{dayLabel(new Date(key))}</h2>
            <Glass shape="panel" className={styles.group}>
              <ol className={styles.list}>
                {list.map(entry => {
                  const Icon = activityIcon(entry, devices);
                  return (
                    <li key={entry.id} className={styles.entry} data-tone={entry.tone} data-lit={activityLit(entry) || undefined} data-picture={entry.picture ? "" : undefined}>
                      <Icon className={styles.icon} size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.text}>
                        {entry.group ? (
                          <button type="button" className={styles.expand} aria-expanded={opened.has(entry.id)} onClick={() => toggle(entry.id)}>
                            <span><b>{entry.name}</b> {entry.what}</span>
                            <ChevronDown className={styles.expandIcon} size={15} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        ) : <span><b>{entry.name}</b> {entry.what}</span>}
                        {(entry.room || entry.by || entry.via) && <span className={styles.meta}>{[entry.room, entry.by && `by ${entry.by}`, entry.via].filter(Boolean).join(" · ")}</span>}
                      </span>
                      {entry.picture && (
                        <a className={styles.picture} href={entry.picture} target="_blank" rel="noreferrer" aria-label={`Picture from when ${entry.name} rang`}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated camera picture that must bypass the image optimiser */}
                          <img src={entry.picture} alt="" loading="lazy" />
                        </a>
                      )}
                      <span className={styles.end}>
                        <time className={styles.time} dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                        {entry.deviceId && devices.has(entry.deviceId) ? (
                          <button type="button" className={styles.mute} onClick={() => void changeQuiet(entry.deviceIds ?? [entry.deviceId as string], entry.name, true)} aria-label={`Mute ${entry.name} in Activity`} title="Mute in Activity">
                            <BellOff size={16} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        ) : <span className={styles.muteSlot} aria-hidden="true" />}
                      </span>
                      {entry.group && opened.has(entry.id) && (
                        <ol className={styles.steps} aria-label={`Each time ${entry.name} changed`}>
                          {entry.group.map(step => (
                            <li key={step.id} className={styles.step} data-lit={activityLit(step) || undefined}>
                              <span className={styles.stepDot} aria-hidden="true" />
                              <span>{step.what}</span>
                              <time className={styles.time} dateTime={step.at}>{new Date(step.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Glass>
          </section>
        ))
      )}
      {more && <Button variant="secondary" className={styles.more} onClick={() => void setSize(size + 1)}>Show earlier</Button>}
      {undo && (
        <div key={undo.at} className={`${glassClass("pill")} ${styles.undo}`} role="status">
          <span>{undo.name} {undo.quiet ? "muted" : "shown again"}</span>
          <button type="button" className={styles.undoButton} onClick={() => { setUndo(null); void setQuiet(undo.deviceIds, !undo.quiet); }}>Undo</button>
        </div>
      )}
    </div>
  );
}
