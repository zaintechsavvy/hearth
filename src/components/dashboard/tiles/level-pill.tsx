"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { clamp } from "@/lib/devices/types";
import styles from "./level-pill.module.css";

const DRAG_THRESHOLD = 4;
/** A press held this long without moving is a hold, which the tile handles, not a tap that toggles. Matches `useLongPress`. */
const HOLD_MS = 450;
/** A finger must rest this long before it drags the level, so a swipe that starts on the pill scrolls the page instead. */
const ARM_MS = 280;
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

/**
 * A vertical level control: drag anywhere to move the level relative to where you started, tap to toggle. On a touch
 * screen the finger rests a moment before it drags, since the pill sits in a page that scrolls the same way. It has
 * no hidden switch for an iPhone's tick, which would hold the swipe for itself.
 */
export function LevelPill({ label, value, on, disabled, onToggle, onCommit, className, children }: LevelPillProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const commits = useRef(0);
  const [armed, setArmed] = useState(false);
  const gesture = useRef<{ y: number; from: number; moved: boolean; at: number; armed: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const pill = useRef<HTMLDivElement>(null);
  const shown = drag ?? sent ?? (on ? value : 0);

  useEffect(() => {
    const element = pill.current;
    if (!element) return;
    // Once armed the finger owns the pill; the page would otherwise start scrolling under it.
    const hold = (event: TouchEvent) => { if (gesture.current?.armed && event.cancelable) event.preventDefault(); };
    element.addEventListener("touchmove", hold, { passive: false });
    return () => element.removeEventListener("touchmove", hold);
  }, []);

  function end() {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = null;
    setArmed(false);
    setDrag(null);
  }

  function send(level: number) {
    const id = ++commits.current;
    setSent(level);
    void onCommit(level).finally(() => { if (commits.current === id) setSent(null); });
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    const touch = event.pointerType === "touch";
    const current = { y: event.clientY, from: shown, moved: false, at: event.timeStamp, armed: !touch } as NonNullable<typeof gesture.current>;
    if (touch) current.timer = setTimeout(() => { current.armed = true; setArmed(true); }, ARM_MS);
    gesture.current = current;
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    const delta = current.y - event.clientY;
    if (!current.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    if (!current.armed) return end();
    // Held only once it drags, so a tap still lands on whatever is under the finger.
    if (!current.moved) event.currentTarget.setPointerCapture(event.pointerId);
    current.moved = true;
    setDrag(clamp(Math.round(current.from + delta / event.currentTarget.clientHeight * 100), 0, 100));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    if (current.moved && drag !== null) send(drag);
    else if (event.timeStamp - current.at < HOLD_MS) onToggle();
    end();
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
      ref={pill}
      data-dragging={drag !== null || undefined}
      data-armed={(armed && drag === null) || undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={end}
      onKeyDown={key}
    >
      <span className={styles.fill} style={{ height: `${shown}%` }} aria-hidden="true" />
      {children?.(shown)}
    </div>
  );
}
