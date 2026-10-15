"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pill, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass } from "@/components/glass/glass";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { DEFAULT_WALL, isNight, WALL_KEY, type WallSettings } from "@/lib/wall";
import { controlTimer, setDoseTaken } from "@/lib/widget-actions";
import { itemsOf, type WidgetItem } from "@/lib/widgets/items";
import { applyTimerControl, doseSlots, timerRemaining, type TimerControl } from "@/lib/widgets/schedules";
import { useHome } from "../use-home";
import { TimerTakeover } from "./timer-takeover";
import { useTick } from "./use-tick";
import styles from "./household-alerts.module.css";

/** A finished timer older than this is old news, not something to ring about. */
const RING_WINDOW_MS = 30 * 60_000;
const CHIME_EVERY_MS = 2500;
const CHIME_FOR_MS = 2 * 60_000;

/** Two soft notes, made on the spot so there is no sound file to load. A wall tablet plays three, louder, to carry across a room; quieter at night. */
function chime(context: AudioContext, loudness: number, notes: number[]) {
  for (const [index, frequency] of notes.entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.18;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(loudness, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 1);
  }
}

/**
 * Household nudges on every page of the app: a timer that ran out rings until someone stops it, and a dose that has
 * come due asks to be marked taken.
 */
export function HouseholdAlerts() {
  const reduce = useReducedMotion();
  const now = useTick(1000) ?? 0;
  const { home, changeItem } = useHome();
  const items = home?.widgets ?? [];
  const [wall] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  const night = wall.enabled && now > 0 && isNight(wall, new Date(now));
  const press = (timer: WidgetItem<"timer">, control: TimerControl) => void changeItem(timer, data => applyTimerControl(data, control), () => controlTimer(timer.id, control));
  const [later, setLater] = useState<Set<string>>(new Set());
  const audio = useRef<AudioContext | null>(null);

  const done = itemsOf(items, "timer").filter(timer => timer.data.endsAt && timerRemaining(timer.data, now) === 0 && now - Date.parse(timer.data.endsAt) < RING_WINDOW_MS);
  const due = now ? itemsOf(items, "medication").flatMap(item => doseSlots(item.data, new Date(now), item.createdAt).filter(slot => slot.state === "due" && slot.at.getTime() <= now && !later.has(`${item.id} ${slot.key}`)).map(slot => ({ item, slot }))) : [];
  const ringing = done.filter(timer => wall.enabled || now - Date.parse(timer.data.endsAt ?? "") < CHIME_FOR_MS).length > 0;
  const loudness = !wall.enabled ? 0.18 : night ? 0.22 : 0.5;

  useEffect(() => {
    const wake = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", wake, { once: true });
    return () => window.removeEventListener("pointerdown", wake);
  }, []);

  useEffect(() => {
    if (!ringing) return;
    const notes = wall.enabled ? [880, 1108.7, 1318.5] : [880, 1318.5];
    const play = () => { if (audio.current?.state === "running") chime(audio.current, loudness, notes); };
    play();
    const timer = setInterval(play, CHIME_EVERY_MS);
    return () => clearInterval(timer);
  }, [ringing, loudness, wall.enabled]);

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: .98 };
  return (
    <div className={styles.stack} aria-live="assertive">
      <AnimatePresence>
        {wall.enabled && done.length > 0 && (
          <TimerTakeover key="takeover" timers={done} now={now} night={night}
            onAdd={timer => press(timer, { action: "add", ms: 60_000 })} onRestart={timer => press(timer, { action: "restart" })} onDismiss={timer => press(timer, { action: "reset" })} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!wall.enabled && done.map(timer => (
          <motion.div key={timer.id} role="alert" className={`${glassClass("pill")} ${styles.banner}`} data-tone="timer"
            initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit } }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
            <span className={styles.icon} aria-hidden="true"><Timer size={18} strokeWidth={1.75} /></span>
            <span className={styles.text}>{timer.data.label} is done<span className={styles.sub}>Timer</span></span>
            <Button size="sm" variant="ghost" onClick={() => press(timer, { action: "add", ms: 60_000 })}>+1 min</Button>
            <Button size="sm" onClick={() => press(timer, { action: "reset" })}>Stop</Button>
          </motion.div>
        ))}
        {due.map(({ item, slot }) => (
          <motion.div key={`${item.id}-${slot.key}`} role="alert" className={`${glassClass("pill")} ${styles.banner}`} data-tone="medication"
            initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit } }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
            <span className={styles.icon} aria-hidden="true"><Pill size={18} strokeWidth={1.75} /></span>
            <span className={styles.text}>
              Time for {item.data.name}{item.data.dose ? ` · ${item.data.dose}` : ""}
              <span className={styles.sub}>{item.data.person ? `${item.data.person} · ` : ""}{slot.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setLater(current => new Set(current).add(`${item.id} ${slot.key}`))}>Later</Button>
            <Button size="sm" onClick={() => void setDoseTaken(item.id, slot.key, true)}>Taken</Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
