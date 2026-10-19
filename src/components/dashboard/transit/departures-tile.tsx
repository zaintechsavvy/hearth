"use client";

import { Bus, Radio } from "lucide-react";
import type { CSSProperties } from "react";
import useSWR from "swr";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Departure } from "@/lib/transit-types";
import { SetupTile } from "../household/choices";
import { useTick } from "../household/use-tick";
import styles from "./departures-tile.module.css";

const ROWS: Record<string, number> = { "2x2": 4, "2x3": 7, "4x2": 8 };

const fetchDepartures = async (url: string) => {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Departures did not load.");
  return body.departures as Departure[];
};

/** Black or white, whichever reads on a route's own colour. */
function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#111111" : "#ffffff";
}

function minutesWords(at: string, now: number) {
  const minutes = Math.round((Date.parse(at) - now) / 60_000);
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `${minutes} min`;
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** The next buses and trains from the chosen stops, soonest first, with live times marked when the agency shares them. */
export function DeparturesTile({ tile, ready, sample, interactive, onManage }: { tile: TileConfig; ready: boolean; sample: boolean; interactive: boolean; onManage: () => void }) {
  const stops = tile.options?.stops ?? [];
  const now = useTick(15_000) ?? 0;
  const { data, error } = useSWR(ready && stops.length ? `/api/transit/departures?stops=${encodeURIComponent(JSON.stringify(stops))}` : null, fetchDepartures, { refreshInterval: 30_000 });
  if (!ready || stops.length === 0) {
    return <SetupTile icon="bus" title="Choose your stops" hint={ready ? "Buses and trains near home" : "Free with a Transitland key"} tone="#16a34a" onClick={onManage} interactive={interactive} />;
  }
  const rows = (data ?? []).filter(item => !item.canceled || Date.parse(item.at) > now).slice(0, ROWS[tile.size] ?? 4);
  const title = stops.length === 1 ? stops[0].name : `${stops.length} stops`;
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label={`Departures from ${title}`}>
      <header className={styles.header}>
        <span className={styles.badge} aria-hidden="true"><Bus size={16} strokeWidth={1.75} /></span>
        <button type="button" className={styles.title} onClick={onManage} disabled={!interactive}>{title}</button>
        {sample && <span className={styles.sample}>Sample times</span>}
      </header>
      {error && !data ? <p className={styles.quiet}>{error.message}</p>
        : !data ? <p className={styles.quiet}>Checking the timetable</p>
          : rows.length === 0 ? <p className={styles.quiet}>Nothing leaves in the next hour and a half.</p> : (
            <ol className={styles.list}>
              {rows.map(item => (
                <li key={item.id} className={styles.row} data-canceled={item.canceled || undefined}>
                  <span className={styles.route} style={item.color ? { "--route": item.color, "--route-ink": ink(item.color) } as CSSProperties : undefined}>{item.route || "—"}</span>
                  <span className={styles.where}>
                    <span className={styles.headsign}>{item.canceled ? "Cancelled" : item.headsign || "Next departure"}</span>
                    {stops.length > 1 && <span className={styles.stop}>{item.stop}</span>}
                  </span>
                  <span className={styles.when}>
                    {item.live && <Radio className={styles.live} size={12} strokeWidth={2} aria-label="Live time" />}
                    {now ? minutesWords(item.at, now) : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
    </section>
  );
}
