"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pill, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass } from "@/components/glass/glass";
import { controlTimer, setDoseTaken } from "@/lib/widget-actions";
import { itemsOf, type WidgetItem } from "@/lib/widgets/items";
import { doseSlots, timerRemaining } from "@/lib/widgets/schedules";
import { useTick } from "./use-tick";
import styles from "./household-alerts.module.css";

/** A finished timer older than this is old news, not something to ring about. */
const RING_WINDOW_MS = 30 * 60_000;
const CHIME_EVERY_MS = 2500;
const CHIME_FOR_MS = 2 * 60_000;

/** Two soft notes, made on the spot so there is no sound file to load. */
function chime(context: AudioContext) {
  for (const [index, frequency] of [880, 1318.5].entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.18;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 1);
  }
}

/**
 * Household nudges on every open dashboard: a timer that ran out rings until someone stops it, and a dose that has
 * come due asks to be marked taken.
 */
export function HouseholdAlerts({ items }: { items: WidgetItem[] }) {
  const reduce = useReducedMotion();
  const now = useTick(1000) ?? 0;
  const [later, setLater] = useState<Set<string>>(new Set());
  const audio = useRef<AudioContext | null>(null);

  const done = itemsOf(items, "timer").filter(timer => timer.data.endsAt && timerRemaining(timer.data, now) === 0 && now - Date.parse(timer.data.endsAt) < RING_WINDOW_MS);
  const due = now ? itemsOf(items, "medication").flatMap(item => doseSlots(item.data, new Date(now)).filter(slot => slot.state === "due" && slot.at.getTime() <= now && !later.has(`${item.id} ${slot.key}`)).map(slot => ({ item, slot }))) : [];
  const ringing = done.filter(timer => now - Date.parse(timer.data.endsAt ?? "") < CHIME_FOR_MS).length > 0;

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
    const play = () => { if (audio.current?.state === "running") chime(audio.current); };
    play();
    const timer = setInterval(play, CHIME_EVERY_MS);
    return () => clearInterval(timer);
  }, [ringing]);

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: .98 };
  return (
    <div className={styles.stack} aria-live="assertive">
      <AnimatePresence>
        {done.map(timer => (
          <motion.div key={timer.id} role="alert" className={`${glassClass("pill")} ${styles.banner}`} data-tone="timer"
            initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit } }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
            <span className={styles.icon} aria-hidden="true"><Timer size={18} strokeWidth={1.9} /></span>
            <span className={styles.text}>{timer.data.label} is done<span className={styles.sub}>Timer</span></span>
            <Button size="sm" variant="ghost" onClick={() => void controlTimer(timer.id, { action: "add", ms: 60_000 })}>+1 min</Button>
            <Button size="sm" onClick={() => void controlTimer(timer.id, { action: "reset" })}>Stop</Button>
          </motion.div>
        ))}
        {due.map(({ item, slot }) => (
          <motion.div key={`${item.id}-${slot.key}`} role="alert" className={`${glassClass("pill")} ${styles.banner}`} data-tone="medication"
            initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit } }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
            <span className={styles.icon} aria-hidden="true"><Pill size={18} strokeWidth={1.9} /></span>
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
