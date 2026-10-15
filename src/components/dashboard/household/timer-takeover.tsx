"use client";

import { BorderBeam } from "border-beam";
import { motion, useReducedMotion } from "motion/react";
import { Plus, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
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

/** On a wall tablet, a finished timer takes the whole screen, above the screensaver and the night dim, so it reads from across the room. */
export function TimerTakeover({ timers, now, night, onAdd, onRestart, onDismiss }: TimerTakeoverProps) {
  const reduce = useReducedMotion();
  const [timer, ...rest] = timers;
  const since = now - Date.parse(timer.data.endsAt ?? "");
  return createPortal(
    <motion.div role="alertdialog" aria-modal="true" aria-labelledby="takeover-title" className={styles.takeover} data-night={night || undefined}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }} transition={{ duration: reduce ? 0 : 0.3 }}>
      <BorderBeam size="pulse-inner" colorVariant="sunset" theme="dark" active={!reduce && !night} strength={night ? 0.25 : 0.8} borderRadius={44}>
        <div className={styles.card}>
          <p className={styles.kicker}>Timer done · {ago(since)}</p>
          <h2 id="takeover-title" className={styles.title}>{timer.data.label}</h2>
          {rest.length > 0 && <p className={styles.more}>{rest.length === 1 ? `${rest[0].data.label} is done too` : `${rest.length} more are done`}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => onAdd(timer)}><Plus size={20} strokeWidth={1.75} aria-hidden="true" />1 min</button>
            <button type="button" className={styles.secondary} onClick={() => onRestart(timer)}><RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />Restart</button>
            <button type="button" className={styles.primary} onClick={() => onDismiss(timer)} autoFocus>Dismiss</button>
          </div>
        </div>
      </BorderBeam>
    </motion.div>,
    document.body,
  );
}
