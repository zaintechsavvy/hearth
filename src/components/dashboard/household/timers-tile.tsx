"use client";

import { Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { glassClass } from "@/components/glass/glass";
import { controlTimer } from "@/lib/widget-actions";
import type { WidgetItem } from "@/lib/widgets/items";
import { applyTimerControl, formatDuration, quickTimer, timerRemaining, type TimerControl } from "@/lib/widgets/schedules";
import { useHome } from "../use-home";
import type { HouseholdTileProps } from "./types";
import { useTick } from "./use-tick";
import styles from "./household.module.css";
import own from "./timers-tile.module.css";

const QUICK = [1, 5, 10, 15, 30];

/** A ring that empties as the time runs out. */
function Ring({ left }: { left: number }) {
  return (
    <svg className={own.ring} viewBox="0 0 100 100" aria-hidden="true">
      <circle className={own.track} cx="50" cy="50" r="46" pathLength={100} />
      <circle className={own.progress} cx="50" cy="50" r="46" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - left * 100} />
    </svg>
  );
}

/** Named timers that run on the server, so every screen counts down together. One timer fills the tile as a dial; quick starts for the usual lengths. */
export function TimersTile({ tile, items, interactive, onManage }: HouseholdTileProps<"timer">) {
  const now = useTick(250) ?? 0;
  const { saveItem, removeItem, changeItem } = useHome();
  const sorted = [...items].sort((a, b) => timerRemaining(a.data, now) - timerRemaining(b.data, now));
  const shown = sorted.slice(0, tile.size === "2x1" ? 1 : tile.size === "2x2" ? 3 : 6);
  const control = (item: WidgetItem<"timer">, press: TimerControl) => void changeItem(item, data => applyTimerControl(data, press), () => controlTimer(item.id, press));
  const start = (minutes: number) => void saveItem("timer", quickTimer(minutes));

  const state = (item: WidgetItem<"timer">) => {
    const left = timerRemaining(item.data, now);
    const running = Boolean(item.data.endsAt);
    const done = running && left === 0;
    const main: { press: TimerControl; label: string; icon: typeof Play } = done ? { press: { action: "restart" }, label: `Restart ${item.data.label}`, icon: RotateCcw }
      : running ? { press: { action: "pause" }, label: `Pause ${item.data.label}`, icon: Pause } : { press: { action: "start" }, label: `Start ${item.data.label}`, icon: Play };
    return { left, running, done, main, fraction: item.data.durationMs ? left / item.data.durationMs : 0, partial: !running && left !== item.data.durationMs };
  };

  const extras = (item: WidgetItem<"timer">, { done, partial }: ReturnType<typeof state>, plusOne: boolean) => (
    <>
      {plusOne && !done && <button type="button" className={own.control} aria-label={`Add a minute to ${item.data.label}`} onClick={() => control(item, { action: "add", ms: 60_000 })}>+1</button>}
      {partial && <button type="button" className={own.control} aria-label={`Reset ${item.data.label}`} onClick={() => control(item, { action: "reset" })}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
      <button type="button" className={own.control} aria-label={`Remove ${item.data.label}`} onClick={() => void removeItem(item.id)}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
    </>
  );

  const body = () => {
    if (shown.length === 0) {
      const quick = QUICK.slice(0, tile.size === "2x1" ? 3 : 5);
      return (
        <div className={own.quick} role="group" aria-label="Start a timer">
          {quick.map(minutes => (
            <button key={minutes} type="button" className={own.quickButton} disabled={!interactive} aria-label={`Start a ${minutes} minute timer`} onClick={() => start(minutes)}>
              <span className={own.quickNumber}>{minutes}</span>
              <span className={own.quickUnit}>min</span>
            </button>
          ))}
          <button type="button" className={own.quickButton} disabled={!interactive} aria-label="New timer" onClick={() => onManage()}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
      );
    }
    if (shown.length === 1 && tile.size !== "2x1") {
      const item = shown[0];
      const timer = state(item);
      const Main = timer.main.icon;
      return (
        <div className={own.hero} data-done={timer.done || undefined} data-running={timer.running || undefined}>
          <div className={own.dial}>
            <Ring left={timer.fraction} />
            <span className={own.dialText}>
              <span className={own.dialTime} aria-live={timer.done ? "assertive" : "off"}>{timer.done ? "Done" : formatDuration(timer.left)}</span>
              <span className={own.label}>{item.data.label}</span>
            </span>
          </div>
          {interactive && (
            <div className={own.heroControls}>
              <button type="button" className={own.primary} aria-label={timer.main.label} onClick={() => control(item, timer.main.press)}><Main size={20} strokeWidth={1.75} aria-hidden="true" /></button>
              {extras(item, timer, true)}
            </div>
          )}
        </div>
      );
    }
    return (
      <ul className={own.rows} data-single={shown.length === 1 || undefined}>
        {shown.map(item => {
          const timer = state(item);
          const Main = timer.main.icon;
          return (
            <li key={item.id} className={own.row} data-done={timer.done || undefined} data-running={timer.running || undefined}>
              <button type="button" className={own.ringButton} disabled={!interactive} aria-label={timer.main.label} onClick={() => control(item, timer.main.press)}>
                <Ring left={timer.fraction} />
                <Main className={own.ringIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <span className={own.text}>
                <span className={own.time} aria-live={timer.done ? "assertive" : "off"}>{timer.done ? "Done" : formatDuration(timer.left)}</span>
                <span className={own.label}>{item.data.label}</span>
              </span>
              {interactive && <span className={own.controls}>{extras(item, timer, tile.size !== "2x1")}</span>}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${own.tile}`} data-size={tile.size} aria-label="Timers">
      {tile.size !== "2x1" && (
        <header className={styles.header}>
          <h3 className={styles.title}>Timers</h3>
          {interactive && shown.length > 0 && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="New timer"><Plus size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
        </header>
      )}
      {body()}
    </section>
  );
}
