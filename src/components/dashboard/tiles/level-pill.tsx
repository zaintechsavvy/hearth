"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { clamp } from "@/lib/devices/types";
import styles from "./level-pill.module.css";

const DRAG_THRESHOLD = 4;
const KEY_STEPS: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 25, PageDown: -25 };

interface LevelPillProps {
  label: string;
  value: number;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onCommit: (value: number) => void;
  className?: string;
  /** Rendered over the fill; receives the level shown right now so labels can follow a drag. */
  children?: (level: number) => ReactNode;
}

/** A vertical level control: drag anywhere to move the level relative to where you started, tap to toggle. */
export function LevelPill({ label, value, on, disabled, onToggle, onCommit, className, children }: LevelPillProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const shown = drag ?? (on ? value : 0);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { y: event.clientY, from: shown, moved: false };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    const delta = current.y - event.clientY;
    if (!current.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    current.moved = true;
    setDrag(clamp(Math.round(current.from + delta / event.currentTarget.clientHeight * 100), 0, 100));
  }

  function up() {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    if (current.moved && drag !== null) onCommit(drag);
    else onToggle();
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
    onCommit(target);
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
