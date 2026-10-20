"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";
import { activityIcon, activityLit } from "@/components/activity/activity-icon";
import { glassClass } from "@/components/glass/glass";
import type { ActivityEntry } from "@/lib/activity-types";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device } from "@/lib/devices/types";
import styles from "./glance.module.css";

const fetchPage = async (url: string): Promise<{ entries: ActivityEntry[] }> => {
  const response = await fetch(url);
  const body = await response.json().catch(() => null) as { entries?: ActivityEntry[]; error?: string } | null;
  if (!response.ok || !body?.entries) throw new Error(body?.error ?? "The activity log is unavailable.");
  return { entries: body.entries };
};

function when(at: string) {
  const date = new Date(at);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  if (date.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return `Yesterday ${time}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The latest changes at home, as Activity lists them, newest first; it reads again whenever the home changes. */
export function ActivityTile({ tile, devices }: { tile: TileConfig; devices: Device[] }) {
  const { data, error, mutate } = useSWR("/api/activity", fetchPage, { refreshInterval: 60_000 });
  useEffect(() => { void mutate(); }, [devices, mutate]);
  const known = new Map(devices.map(device => [device.id, device]));
  const entries = data?.entries ?? [];
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Activity">
      <header className={styles.header}>
        <span className={styles.title}>Activity</span>
        <Link href="/activity" className={styles.meta}>See all</Link>
      </header>
      {error ? <p className={styles.meta}>{error.message}</p>
        : data && entries.length === 0 ? <p className={styles.meta}>Nothing yet today.</p>
          : (
            <ol className={`${styles.rows} ${styles.activityRows}`} data-wide={tile.size.startsWith("4") || undefined}>
              {entries.slice(0, 12).map(entry => {
                const Icon = activityIcon(entry, known);
                return (
                  <li key={entry.id} className={styles.row} data-tone={entry.tone} data-lit={activityLit(entry) || undefined}>
                    <span className={styles.activityIcon}><Icon size={15} strokeWidth={1.75} aria-hidden="true" /></span>
                    <span className={styles.text}>
                      <span className={`${styles.rowName} ${styles.activityLine}`}>{entry.name} <span className={styles.activityWhat}>{entry.what}</span></span>
                      {(entry.by || entry.room) && <span className={styles.meta}>{entry.by ? `by ${entry.by}` : entry.room}</span>}
                    </span>
                    <time className={styles.meta} dateTime={entry.at}>{when(entry.at)}</time>
                  </li>
                );
              })}
            </ol>
          )}
    </section>
  );
}
