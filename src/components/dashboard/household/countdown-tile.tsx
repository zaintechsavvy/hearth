"use client";

import type { CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { countdownDays } from "@/lib/widgets/schedules";
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./countdown-tile.module.css";

/** Days until one date, in big type, tinted its own colour. Yearly dates roll on to next year once they pass. */
export function CountdownTile({ tile, items, interactive, onManage }: HouseholdTileProps<"countdown">) {
  const now = useMinute();
  const item = items.find(entry => entry.id === tile.options?.itemId);
  if (!item) return <SetupTile icon="hourglass" title="Set up a countdown" hint="A trip, a birthday, a big day" tone="#8b5cf6" onClick={() => onManage()} interactive={interactive} wide={tile.size === "2x1"} />;
  const { days, date } = now === null ? { days: 0, date: new Date() } : countdownDays(item.data, new Date(now));
  const past = days < 0;
  return (
    <button type="button" className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} data-today={days === 0 || undefined}
      style={{ "--accent": item.data.color } as CSSProperties} onClick={() => onManage(item.id)} disabled={!interactive}
      aria-label={`${item.data.title}: ${days === 0 ? "today" : past ? `${-days} days ago` : `${days} days to go`}`}>
      <span className={styles.emoji} aria-hidden="true">{item.data.emoji}</span>
      <span className={styles.count}>
        {now === null ? null : days === 0 ? <b>Today</b> : <><b>{Math.abs(days)}</b><small>{Math.abs(days) === 1 ? "day" : "days"} {past ? "ago" : "to go"}</small></>}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{item.data.title}</span>
        <span className={styles.date}>{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}</span>
      </span>
    </button>
  );
}
