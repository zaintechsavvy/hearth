"use client";

import { useEffect, useState, type PointerEvent } from "react";
import useSWR from "swr";
import { activityIcon, activityLit } from "@/components/activity/activity-icon";
import { useHome } from "@/components/dashboard/use-home";
import type { ActivityEntry } from "@/lib/activity-types";
import styles from "./rest-activity.module.css";

const SHOWN = 4;
/** How far a downward swipe has to travel to clear the notes. */
const CLEAR_PX = 48;

const fetchPage = (url: string): Promise<{ entries: ActivityEntry[] }> => fetch(url).then(response => { if (!response.ok) throw new Error(); return response.json(); });

/**
 * On the resting screen, what happened since it went to rest, as up to four quiet notes in the corner, newest at the
 * foot. A swipe down clears them; touching them does not wake the screen.
 */
export function RestActivity({ since }: { since: number }) {
  const { home } = useHome();
  const { data, mutate } = useSWR("/api/activity", fetchPage, { refreshInterval: 30_000 });
  useEffect(() => { void mutate(); }, [home?.devices, mutate]);
  const [cleared, setCleared] = useState(0);
  const [drag, setDrag] = useState<{ from: number; by: number } | null>(null);
  const known = new Map((home?.devices ?? []).map(device => [device.id, device]));
  const after = Math.max(since, cleared);
  const notes = (data?.entries ?? []).filter(entry => Date.parse(entry.at) > after).slice(0, SHOWN).reverse();
  if (!since || notes.length === 0) return null;

  const hold = (event: PointerEvent) => event.stopPropagation();
  const end = (event: PointerEvent) => {
    event.stopPropagation();
    if (drag && drag.by > CLEAR_PX) setCleared(performance.timeOrigin + event.timeStamp);
    setDrag(null);
  };
  return (
    <ol className={styles.notes} aria-label="Since the screen rested" data-dragging={drag ? "" : undefined}
      style={drag ? { transform: `translateY(${Math.max(0, drag.by)}px)`, opacity: Math.max(0, 1 - drag.by / 120) } : undefined}
      onClick={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
      onPointerDown={event => { hold(event); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ from: event.clientY, by: 0 }); }}
      onPointerMove={event => { if (drag) setDrag({ ...drag, by: event.clientY - drag.from }); }}
      onPointerUp={end} onPointerCancel={end}>
      {notes.map(entry => {
        const Icon = activityIcon(entry, known);
        return (
          <li key={entry.id} className={styles.note} data-lit={activityLit(entry) || undefined} data-tone={entry.tone}>
            <Icon className={styles.icon} size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.text}>{entry.name} {entry.what}</span>
            <time className={styles.time} dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
          </li>
        );
      })}
    </ol>
  );
}
