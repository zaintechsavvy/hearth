"use client";

import { Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import type { CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { controlTimer, deleteWidgetItem, saveWidgetItem } from "@/lib/widget-actions";
import { formatDuration, timerRemaining } from "@/lib/widgets/schedules";
import type { HouseholdTileProps } from "./types";
import { useTick } from "./use-tick";
import styles from "./household.module.css";
import own from "./timers-tile.module.css";

const QUICK = [1, 5, 10, 15, 30];

export async function startQuickTimer(minutes: number) {
  const durationMs = minutes * 60_000;
  return saveWidgetItem("timer", { label: `${minutes} min`, durationMs, remainingMs: durationMs, endsAt: new Date(Date.now() + durationMs).toISOString() });
}

/** Named timers that run on the server, so every screen counts down together. Quick starts for the usual lengths. */
export function TimersTile({ tile, items, interactive, onManage }: HouseholdTileProps<"timer">) {
  const now = useTick(250) ?? 0;
  const sorted = [...items].sort((a, b) => timerRemaining(a.data, now) - timerRemaining(b.data, now));
  const shown = sorted.slice(0, tile.size === "2x1" ? 1 : tile.size === "2x2" ? 3 : 6);
  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${own.tile}`} data-size={tile.size} aria-label="Timers">
      {tile.size !== "2x1" && (
        <header className={styles.header}>
          <h3 className={styles.title}>Timers</h3>
          {interactive && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="New timer"><Plus size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
        </header>
      )}
      {shown.length === 0 ? (
        <div className={own.quick} role="group" aria-label="Start a timer">
          {QUICK.slice(0, tile.size === "2x1" ? 3 : 5).map(minutes => (
            <button key={minutes} type="button" className={own.quickButton} disabled={!interactive} onClick={() => void startQuickTimer(minutes)}>{minutes}<small>min</small></button>
          ))}
          {tile.size === "2x1" && <button type="button" className={own.quickButton} disabled={!interactive} onClick={() => onManage()} aria-label="New timer"><Plus size={18} strokeWidth={1.75} aria-hidden="true" /></button>}
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map(item => {
            const left = timerRemaining(item.data, now);
            const running = Boolean(item.data.endsAt);
            const done = running && left === 0;
            const progress = 1 - left / item.data.durationMs;
            return (
              <li key={item.id} className={own.timer} data-done={done || undefined} data-running={running || undefined} style={{ "--progress": progress } as CSSProperties}>
                <span className={own.ring} aria-hidden="true" />
                <span className={own.text}>
                  <span className={own.time} aria-live={done ? "assertive" : "off"}>{done ? "Done" : formatDuration(left)}</span>
                  <span className={own.label}>{item.data.label}</span>
                </span>
                {interactive && (
                  <span className={own.controls}>
                    {!done && (
                      <button type="button" className={own.control} aria-label={running ? `Pause ${item.data.label}` : `Start ${item.data.label}`} onClick={() => void controlTimer(item.id, { action: running ? "pause" : "start" })}>
                        {running ? <Pause size={15} strokeWidth={2} aria-hidden="true" /> : <Play size={15} strokeWidth={2} aria-hidden="true" />}
                      </button>
                    )}
                    {tile.size !== "2x1" && !done && (
                      <button type="button" className={own.control} aria-label={`Add a minute to ${item.data.label}`} onClick={() => void controlTimer(item.id, { action: "add", ms: 60_000 })}>+1</button>
                    )}
                    {(done || !running) && left !== item.data.durationMs && (
                      <button type="button" className={own.control} aria-label={`Reset ${item.data.label}`} onClick={() => void controlTimer(item.id, { action: "reset" })}><RotateCcw size={14} strokeWidth={2} aria-hidden="true" /></button>
                    )}
                    <button type="button" className={own.control} aria-label={`Remove ${item.data.label}`} onClick={() => void deleteWidgetItem(item.id)}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
