"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { clamp } from "@/lib/devices/types";
import styles from "./level-pill.module.css";

const DRAG_THRESHOLD = 4;
/** A press held this long without moving is a hold, which the tile handles, not a tap that toggles. Matches `useLongPress`. */
const HOLD_MS = 450;
const KEY_STEPS: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 25, PageDown: -25 };

interface LevelPillProps {
  label: string;
  value: number;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Sends the level. The pill keeps showing it until the returned promise settles, so it never flicks back to the old level. */
  onCommit: (value: number) => Promise<unknown>;
  className?: string;
  /** Rendered over the fill; receives the level shown right now so labels can follow a drag. */
  children?: (level: number) => ReactNode;
}

/** A vertical level control: drag anywhere to move the level relative to where you started, tap to toggle. */
export function LevelPill({ label, value, on, disabled, onToggle, onCommit, className, children }: LevelPillProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const commits = useRef(0);
  const gesture = useRef<{ y: number; from: number; moved: boolean; at: number } | null>(null);
  const shown = drag ?? sent ?? (on ? value : 0);

  function send(level: number) {
    const id = ++commits.current;
    setSent(level);
    void onCommit(level).finally(() => { if (commits.current === id) setSent(null); });
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    gesture.current = { y: event.clientY, from: shown, moved: false, at: event.timeStamp };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    const delta = current.y - event.clientY;
    if (!current.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    // Held only once it drags: a tap must still land on what is under the finger, such as the switch that ticks on an iPhone.
    if (!current.moved) event.currentTarget.setPointerCapture(event.pointerId);
    current.moved = true;
    setDrag(clamp(Math.round(current.from + delta / event.currentTarget.clientHeight * 100), 0, 100));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    if (current.moved && drag !== null) send(drag);
    else if (event.timeStamp - current.at < HOLD_MS) onToggle();
    setDrag(null);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      return onToggle();
    }
    const step = KEY_STEPS[event.key];
    const target = step !== undefined ? clamp(shown + step, 0, 100) : event.key === "Home" ? 0 : event.key === "End" ? 100 : null;
    if (target === null) return;
    event.preventDefault();
    send(target);
  }

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-valuetext={shown === 0 ? "Off" : `${shown}%`}
      aria-disabled={disabled || undefined}
      className={[styles.pill, className].filter(Boolean).join(" ")}
      data-dragging={drag !== null || undefined}
      data-haptic
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { gesture.current = null; setDrag(null); }}
      onKeyDown={key}
    >
      <span className={styles.fill} style={{ height: `${shown}%` }} aria-hidden="true" />
      {children?.(shown)}
    </div>
  );
}
