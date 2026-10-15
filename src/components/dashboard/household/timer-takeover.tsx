"use client";

import { motion, useReducedMotion } from "motion/react";
import { Plus, RotateCcw, Timer } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassSheetClass } from "@/components/glass/glass";
import type { WidgetItem } from "@/lib/widgets/items";
import styles from "./timer-takeover.module.css";

interface TimerTakeoverProps {
  timers: WidgetItem<"timer">[];
  now: number;
  night: boolean;
  onAdd: (timer: WidgetItem<"timer">) => void;
  onRestart: (timer: WidgetItem<"timer">) => void;
  onDismiss: (timer: WidgetItem<"timer">) => void;
}

const ago = (ms: number) => ms < 60_000 ? "Just now" : `${Math.floor(ms / 60_000)} min ago`;

/** On a wall tablet, a finished timer rises over everything, above the screensaver and the night dim, large enough to read across the room. */
export function TimerTakeover({ timers, now, night, onAdd, onRestart, onDismiss }: TimerTakeoverProps) {
  const reduce = useReducedMotion();
  const [timer, ...rest] = timers;
  const since = now - Date.parse(timer.data.endsAt ?? "");
  return createPortal(
    <motion.div role="alertdialog" aria-modal="true" aria-labelledby="takeover-title" className={styles.takeover} data-night={night || undefined}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }} transition={{ duration: reduce ? 0 : 0.25 }}>
      <motion.div className={`${glassSheetClass} ${styles.card}`} initial={reduce ? false : { opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
        <span className={styles.icon} aria-hidden="true"><Timer size={28} strokeWidth={1.75} /></span>
        <p className={styles.kicker}>Timer done · {ago(since)}</p>
        <h2 id="takeover-title" className={styles.title}>{timer.data.label}</h2>
        {rest.length > 0 && <p className={styles.more}>{rest.length === 1 ? `${rest[0].data.label} is done too` : `${rest.length} more are done`}</p>}
        <div className={styles.actions}>
          <Button size="lg" variant="secondary" onClick={() => onAdd(timer)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> 1 min</Button>
          <Button size="lg" variant="secondary" onClick={() => onRestart(timer)}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /> Restart</Button>
          <Button size="lg" onClick={() => onDismiss(timer)} autoFocus>Dismiss</Button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
