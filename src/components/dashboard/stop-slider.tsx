"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { cue } from "@/lib/sound";
import styles from "./stop-slider.module.css";

interface StopSliderProps {
  label: string;
  /** How many stops the track has; the thumb only ever rests on one. */
  count: number;
  index: number;
  disabled?: boolean;
  valueText: (index: number) => string;
  /** The stops with a label printed under the track. */
  marks: number[];
  markText: (index: number) => string;
  /** Every stop the thumb passes while it is dragged. */
  onInput: (index: number) => void;
  /** Once it is let go, or straight away from the keys. */
  onCommit: (index: number) => void;
}

const share = (index: number, count: number) => count > 1 ? index / (count - 1) * 100 : 0;

/** A slider that snaps to a fixed set of stops while it is dragged, with a 44px hit area round a slim track. */
export function StopSlider({ label, count, index, disabled, valueText, marks, markText, onInput, onCommit }: StopSliderProps) {
  const rail = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ pointer: number; index: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function indexAt(event: PointerEvent) {
    const box = rail.current!.getBoundingClientRect();
    const at = box.width ? (event.clientX - box.left) / box.width : 0;
    return Math.round(Math.min(1, Math.max(0, at)) * (count - 1));
  }

  function step(next: number) {
    if (!drag.current || drag.current.index === next) return;
    cue("select", { emphasis: "subtle", direction: next > drag.current.index ? "forward" : "back" });
    drag.current.index = next;
    onInput(next);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || drag.current || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, index };
    setDragging(true);
    step(indexAt(event));
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer === event.pointerId) step(indexAt(event));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    const { index: last } = drag.current;
    drag.current = null;
    setDragging(false);
    onCommit(last);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const end = count - 1;
    const by: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 };
    const next = event.key === "Home" ? 0 : event.key === "End" ? end : event.key in by ? Math.min(end, Math.max(0, index + by[event.key])) : null;
    if (next === null) return;
    event.preventDefault();
    if (next === index) return;
    onInput(next);
    onCommit(next);
  }

  return (
    <div className={styles.root}>
      <div className={styles.stops} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={0} aria-valuemax={count - 1}
        aria-valuenow={index} aria-valuetext={valueText(index)} aria-disabled={disabled || undefined} data-dragging={dragging || undefined}
        style={{ "--at": `${share(index, count)}%` } as CSSProperties}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
        <span ref={rail} className={styles.rail} aria-hidden="true">
          <span className={styles.filled} />
          {Array.from({ length: count }, (_, stop) => stop === 0 || stop === count - 1 ? null
            : <span key={stop} className={styles.dot} style={{ left: `${share(stop, count)}%` }} data-filled={stop < index || undefined} />)}
          <span className={styles.thumb} />
        </span>
      </div>
      <div className={styles.marks} aria-hidden="true">
        {marks.map(stop => <span key={stop} style={{ left: `${share(stop, count)}%` }} data-on={stop === index || undefined}>{markText(stop)}</span>)}
      </div>
    </div>
  );
}
