"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Leaf, MoreHorizontal, Package, Pill, Recycle, Thermometer, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { useHome } from "@/components/dashboard/use-home";
import { useTick } from "@/components/dashboard/household/use-tick";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { isWidget, type TileConfig } from "@/lib/dashboard/layout";
import { DEFAULT_WALL, isNight, WALL_KEY, type WallSettings } from "@/lib/wall";
import type { Agenda } from "@/lib/widgets/calendar";
import { itemsOf } from "@/lib/widgets/items";
import { doseSlots, groupPickups, pickupWords, timerColors, timerRemaining, formatDuration } from "@/lib/widgets/schedules";
import { skyWords } from "@/lib/widgets/weather-codes";
import type { Forecast } from "@/lib/widgets/weather";
import styles from "./wall-mode.module.css";

const SHIFT_EVERY_MS = 10 * 60_000;
const SHIFT_PX = 4;
const DRIFT_EVERY_MS = 60_000;
const NIGHT_RED = "oklch(52% 0.16 25)";
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

const fetchJson = <T,>(url: string): Promise<T> => fetch(url).then(response => { if (!response.ok) throw new Error(); return response.json(); });

/** Wall tablet mode, on this device only: keeps the screen on, dims at night, rests on a glanceable screensaver, and wakes on touch or motion. */
export function WallMode() {
  const [settings] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.enabled) root.dataset.wall = settings.showAssistant ? "assistant" : "";
    else delete root.dataset.wall;
    return () => { delete root.dataset.wall; };
  }, [settings.enabled, settings.showAssistant]);
  return settings.enabled ? <Wall settings={settings} /> : null;
}

function Wall({ settings }: { settings: WallSettings }) {
  const reduce = useReducedMotion();
  const { home } = useHome();
  const now = useTick(1000) ?? 0;
  const [resting, setResting] = useState(false);
  const [menu, setMenu] = useState(false);
  const lastActive = useRef(0);
  const sensorState = useRef<Map<string, boolean>>(new Map());
  const night = now > 0 && isNight(settings, new Date(now));

  useEffect(() => {
    lastActive.current = Date.now();
    const wake = () => {
      lastActive.current = Date.now();
      setResting(false);
    };
    for (const type of ACTIVITY) window.addEventListener(type, wake, { passive: true });
    return () => { for (const type of ACTIVITY) window.removeEventListener(type, wake); };
  }, []);

  useEffect(() => {
    if (!settings.idleMinutes || resting || !now) return;
    if (now - lastActive.current >= settings.idleMinutes * 60_000) setResting(true);
  }, [now, resting, settings.idleMinutes]);

  useEffect(() => {
    for (const device of home?.devices ?? []) {
      if (!settings.wakeSensors.includes(device.id) || device.kind !== "binary_sensor") continue;
      const was = sensorState.current.get(device.id);
      sensorState.current.set(device.id, device.active);
      if (was === false && device.active) {
        lastActive.current = Date.now();
        setResting(false);
      }
    }
  }, [home?.devices, settings.wakeSensors]);

  useEffect(() => {
    if (!settings.keepAwake || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState === "visible") void navigator.wakeLock.request("screen").then(sentinel => { lock = sentinel; }).catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [settings.keepAwake]);

  useEffect(() => {
    const root = document.documentElement;
    const shift = () => {
      root.style.setProperty("--wall-shift-x", `${Math.round((Math.random() * 2 - 1) * SHIFT_PX)}px`);
      root.style.setProperty("--wall-shift-y", `${Math.round((Math.random() * 2 - 1) * SHIFT_PX)}px`);
    };
    shift();
    const timer = setInterval(shift, SHIFT_EVERY_MS);
    return () => {
      clearInterval(timer);
      root.style.removeProperty("--wall-shift-x");
      root.style.removeProperty("--wall-shift-y");
    };
  }, []);

  return (
    <>
      <div className={styles.dim} style={{ opacity: night && !resting ? settings.dimLevel : 0 }} aria-hidden="true" />
      <AnimatePresence>
        {resting && (
          <motion.button type="button" key="saver" className={styles.saver} data-night={night || undefined} aria-label="Wake the screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.6 }}
            onClick={() => { lastActive.current = Date.now(); setResting(false); }}>
            <Glance now={now} night={night} dimLevel={settings.dimLevel} />
          </motion.button>
        )}
      </AnimatePresence>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button type="button" className={`${glassClass("pill")} ${styles.menu}`} aria-label="Wall tablet options"><MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className={`${glassSheetClass} ${styles.menuContent}`}>
          <Link href="/settings#wall" className={styles.menuItem} onClick={() => setMenu(false)}>Wall tablet settings</Link>
          <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); setResting(true); }}>Rest the screen now</button>
          <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); void document.documentElement.requestFullscreen?.().catch(() => {}); }}>Full screen</button>
        </PopoverContent>
      </Popover>
    </>
  );
}

/** The resting screen: time, weather, and the next thing that needs doing. It drifts a little each minute so nothing burns in. */
function Glance({ now, night, dimLevel }: { now: number; night: boolean; dimLevel: number }) {
  const { home } = useHome();
  const date = new Date(now || 0);
  const drift = Math.floor(now / DRIFT_EVERY_MS);
  const offset = { "--drift-x": `${((drift * 37) % 41) - 20}px`, "--drift-y": `${((drift * 53) % 31) - 15}px`, "--saver-dim": night ? 1 - dimLevel * 0.6 : 1 } as CSSProperties;
  const tiles = home?.pages.flatMap(page => page.layout).filter((tile): tile is TileConfig => "kind" in tile && tile.kind !== undefined && isWidget(tile.kind)) ?? [];
  const place = tiles.find(tile => tile.kind === "weather" && tile.options?.place)?.options;
  const { data: weather } = useSWR<Forecast>(place?.place ? `/api/weather?lat=${place.place.latitude}&lon=${place.place.longitude}` : null, fetchJson, { refreshInterval: 10 * 60_000 });
  const { data: agenda } = useSWR<Agenda>(tiles.some(tile => tile.kind === "calendar") ? "/api/calendar" : null, fetchJson, { refreshInterval: 5 * 60_000 });

  const notes: { icon: ReactNode; text: string; key: string }[] = [];
  const widgets = home?.widgets ?? [];
  const timers = itemsOf(widgets, "timer").filter(item => item.data.endsAt && timerRemaining(item.data, now) > 0)
    .sort((a, b) => timerRemaining(a.data, now) - timerRemaining(b.data, now)).slice(0, 3);
  const colors = timerColors(timers);
  const pickup = groupPickups(itemsOf(widgets, "bin"), date)[0];
  if (pickup && pickup.days <= 1) notes.push({ key: "bins", icon: <Recycle size={18} strokeWidth={1.75} />, text: `${pickup.bins.map(bin => bin.data.name).join(" and ")} · ${pickupWords(pickup.days, date)}` });
  const dose = itemsOf(widgets, "medication").flatMap(item => doseSlots(item.data, date, item.createdAt).filter(slot => slot.state === "due" || slot.state === "upcoming").map(slot => ({ item, slot })))
    .sort((a, b) => a.slot.at.getTime() - b.slot.at.getTime())[0];
  if (dose) notes.push({ key: "dose", icon: <Pill size={18} strokeWidth={1.75} />, text: `${dose.item.data.name}${dose.item.data.person ? ` for ${dose.item.data.person}` : ""} at ${dose.slot.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` });
  const next = agenda?.events.find(event => event.allDay ? event.start >= date.toISOString().slice(0, 10) : Date.parse(event.end) > now);
  if (next) notes.push({ key: "event", icon: <CalendarDays size={18} strokeWidth={1.75} />, text: `${next.title} · ${next.allDay ? "all day" : new Date(next.start).toLocaleTimeString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` });
  const thirsty = itemsOf(widgets, "plant").filter(item => now - Date.parse(item.data.lastWatered) >= item.data.everyDays * 86_400_000).length;
  if (thirsty) notes.push({ key: "plants", icon: <Leaf size={18} strokeWidth={1.75} />, text: `${thirsty} ${thirsty === 1 ? "plant needs" : "plants need"} water` });
  const waiting = itemsOf(widgets, "package").filter(item => item.data.status === "delivered");
  if (waiting.length) notes.push({ key: "packages", icon: <Package size={18} strokeWidth={1.75} />, text: waiting.length === 1 ? `${waiting[0].data.name} is here, collect it` : `${waiting.length} packages to collect` });

  return (
    <span className={styles.glance} style={offset}>
      <span className={styles.time}>{now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}</span>
      <span className={styles.date}>{now ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}</span>
      {weather && (
        <span className={styles.weather}>
          <Thermometer size={18} strokeWidth={1.75} aria-hidden="true" />
          {Math.round(place?.units === "F" ? weather.current.temperature * 9 / 5 + 32 : weather.current.temperature)}° · {skyWords(weather.current.code, weather.current.day)}
        </span>
      )}
      {timers.length > 0 && (
        <span className={styles.timers} data-night={night || undefined}>
          {timers.map(timer => {
            const left = timerRemaining(timer.data, now);
            return (
              <span key={timer.id} className={styles.timer} style={{ "--timer": night ? NIGHT_RED : timers.length > 1 ? colors.get(timer.id) : "currentColor" } as CSSProperties}>
                <svg className={styles.timerRing} viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" pathLength={100} className={styles.timerTrack} />
                  <circle cx="50" cy="50" r="44" pathLength={100} className={styles.timerProgress} strokeDasharray="100" strokeDashoffset={100 - (left / timer.data.durationMs) * 100} />
                </svg>
                <span className={styles.timerText}>
                  <span className={styles.timerTime}>{formatDuration(left)}</span>
                  <span className={styles.timerLabel}><Timer size={14} strokeWidth={1.75} aria-hidden="true" /> {timer.data.label}</span>
                </span>
              </span>
            );
          })}
        </span>
      )}
      {notes.length > 0 && (
        <span className={styles.notes}>
          {notes.slice(0, 4).map(note => <span key={note.key} className={styles.note}><span className={styles.noteIcon} aria-hidden="true">{note.icon}</span>{note.text}</span>)}
        </span>
      )}
      <span className={styles.hint}>Touch to wake</span>
    </span>
  );
}
