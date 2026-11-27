"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { DIAL_START, DIAL_SWEEP, angleToValue, arcPath, pointAngle, polar, snap, tickValues, valueToAngle } from "./dial-math";
import styles from "./thermostat-dial.module.css";

/** The dial's drawing box: the arc's centre and radius, and how far in its ticks sit. */
const SIZE = 240, C = SIZE / 2, R = 104, TICK_IN = R - 24, TICK_OUT = R - 16;
/** A press this close to the centre, as a share of the radius, is on the reading, not the arc. */
const DEAD_CENTRE = 0.42;

export type DialTone = "warm" | "cool" | "neutral" | "off";

interface ThermostatDialProps {
  name: string;
  unit: string;
  value: number;
  current: number | null;
  min: number;
  max: number;
  step: number;
  tone: DialTone;
  /** Heating or cooling now: the ticks between the room and the setpoint light up as the way still to go. */
  active: boolean;
  disabled: boolean;
  format: (value: number) => string;
  /** Every new value while it is chosen; `settled` once a drag is released or a key or button sets it. */
  onChange: (value: number, settled: boolean) => void;
  children: ReactNode;
}

/** A thermostat's setpoint on a 270 degree arc, cooler to the left and warmer to the right, dragged by its handle or set with the keys or the buttons. */
export function ThermostatDial({ name, unit, value, current, min, max, step, tone, active, disabled, format, onChange, children }: ThermostatDialProps) {
  const reduce = useReducedMotion();
  const range = { min, max, step };
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; value: number } | null>(null);
  const angle = useMotionValue(valueToAngle(value, range));
  const fill = useTransform(angle, to => arcPath(C, C, R, DIAL_START, Math.max(DIAL_START + 0.01, to)));
  const handleX = useTransform(angle, to => polar(C, C, R, to).x);
  const handleY = useTransform(angle, to => polar(C, C, R, to).y);

  useEffect(() => {
    const to = valueToAngle(value, { min, max, step });
    if (drag.current || reduce) angle.set(to);
    else animate(angle, to, motionTokens.spring.snappy);
  }, [value, min, max, step, reduce, angle]);

  function valueAt(event: PointerEvent, from: number) {
    const box = root.current!.getBoundingClientRect();
    return angleToValue(pointAngle(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2), range, from);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || drag.current || (event.target as Element).closest("button")) return;
    const box = root.current!.getBoundingClientRect();
    const distance = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
    if (distance < box.width / 2 * DEAD_CENTRE) return;
    root.current!.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, value: valueAt(event, value) };
    root.current!.dataset.dragging = "";
    onChange(drag.current.value, false);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    const next = valueAt(event, drag.current.value);
    if (next === drag.current.value) return;
    drag.current.value = next;
    onChange(next, false);
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    const { value: last } = drag.current;
    drag.current = null;
    delete root.current!.dataset.dragging;
    onChange(last, true);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const by: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 5, PageDown: -step * 5 };
    const next = event.key === "Home" ? min : event.key === "End" ? max : event.key in by ? snap(value + by[event.key], range) : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next, true);
  }

  const lit = current === null || !active ? null : [Math.min(current, value), Math.max(current, value)];
  const marker = current === null || current < min || current > max ? null : polar(C, C, R, valueToAngle(current, range));
  const nudge = (direction: 1 | -1) => onChange(snap(value + direction * step, range), true);

  return (
    <div
      ref={root}
      className={styles.dial}
      data-tone={tone}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${name} target temperature`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${format(value)}°${unit}`}
      aria-disabled={disabled || undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <svg className={styles.face} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <g className={styles.ticks}>
          {tickValues(range).map(tick => {
            const at = valueToAngle(tick, range), inner = polar(C, C, TICK_IN, at), outer = polar(C, C, TICK_OUT, at);
            return <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} data-lit={lit && tick >= lit[0] && tick <= lit[1] ? "" : undefined} />;
          })}
        </g>
        <path className={styles.track} d={arcPath(C, C, R, DIAL_START, DIAL_START + DIAL_SWEEP)} />
        {tone !== "off" && <motion.path className={styles.fill} d={fill} />}
        {marker && <circle className={styles.current} cx={marker.x} cy={marker.y} r={4} />}
        <motion.circle className={styles.handle} cx={handleX} cy={handleY} r={15} />
      </svg>
      <div className={styles.centre}>{children}</div>
      <div className={styles.buttons}>
        <button type="button" tabIndex={-1} className={styles.button} disabled={disabled || value <= min} onClick={() => nudge(-1)} aria-label={`Lower to ${format(Math.max(min, value - step))}°`}>
          <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button type="button" tabIndex={-1} className={styles.button} disabled={disabled || value >= max} onClick={() => nudge(1)} aria-label={`Raise to ${format(Math.min(max, value + step))}°`}>
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
