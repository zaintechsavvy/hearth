"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { dialColorOf, isLight, type WallSettings } from "@/lib/wall";
import { SweepHand, useClockNow } from "./analog-face";
import styles from "./luxury-face.module.css";

const H = 1000;
const NUMERALS = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const rad = (angle: number) => (angle - 90) * Math.PI / 180;
/** Two decimals, so the server and the browser, whose trigonometry can differ in the last digits, draw the same marks. */
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Where a ray from the centre at `angle` meets a rounded rectangle `hx` by `hy` either side with corners of radius `r`,
 * relative to the centre, and the outward normal there in degrees, which a mark is turned to face.
 */
function onEdge(angle: number, hx: number, hy: number, r: number) {
  const dx = Math.cos(rad(angle)), dy = Math.sin(rad(angle));
  const t = Math.min(Math.abs(dx) > 1e-9 ? hx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? hy / Math.abs(dy) : Infinity);
  const x = dx * t, y = dy * t;
  if (Math.abs(x) > hx - r && Math.abs(y) > hy - r) {
    const ox = Math.sign(x) * (hx - r), oy = Math.sign(y) * (hy - r);
    const b = dx * ox + dy * oy;
    const s = b + Math.sqrt(Math.max(0, b * b - (ox * ox + oy * oy - r * r)));
    return { x: dx * s, y: dy * s, normal: Math.atan2(dy * s - oy, dx * s - ox) * 180 / Math.PI };
  }
  return { x, y, normal: Math.abs(x) >= hx - 1e-6 ? (x > 0 ? 0 : 180) : (y > 0 ? 90 : -90) };
}

/** A tapered sword hand from just behind the centre to `length`, drawn pointing at 12. */
const handPath = (cx: number, cy: number, length: number, width: number, tail: number) =>
  `M ${cx - width / 2} ${cy + tail} L ${cx - width * .62} ${cy - length * .72} L ${cx} ${cy - length} L ${cx + width * .62} ${cy - length * .72} L ${cx + width / 2} ${cy + tail} Z`;

/**
 * A dress dial shaped like the screen and filling it to the corners: a railroad minute track that follows its edge,
 * upright Roman numerals just inside it, and sword hands that reach the track at every angle.
 */
export function LuxuryFace({ night, settings, inline = false }: { night: boolean; settings: WallSettings; inline?: boolean }) {
  const now = useClockNow();
  const reduce = useReducedMotion();
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const [aspect, setAspect] = useState(1.42);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.height) setAspect(entry.contentRect.width / entry.contentRect.height); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const W = Math.round(H * aspect);
  const cx = W / 2, cy = H / 2;
  const track = { hx: cx - H * .055, hy: cy - H * .055, r: H * .07, half: H * .018 };
  const ring = { hx: cx - H * .19, hy: cy - H * .17, r: H * .05 };
  const numeral = H * .095;
  const sweep = settings.secondHand === "smooth" && !reduce;
  const date = new Date(now);
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const dial = dialColorOf(settings);
  const light = isLight(dial);
  const style = {
    "--dial": dial,
    "--ink": light ? "oklch(22% 0.01 250)" : "oklch(94% 0.01 90)",
    "--hand": settings.handColor ?? (light ? "oklch(38% 0.12 262)" : "oklch(92% 0.03 85)"),
  } as CSSProperties;

  const rail = (offset: number) => (
    <rect x={round(cx - track.hx - offset)} y={round(cy - track.hy - offset)} width={round(2 * (track.hx + offset))} height={round(2 * (track.hy + offset))} rx={round(track.r + offset)} className={styles.rail} />
  );
  const ticks = Array.from({ length: 60 }, (_, minute) => {
    const { x, y, normal } = onEdge(minute * 6, track.hx, track.hy, track.r);
    const along = (distance: number) => [round(cx + x + Math.cos(normal * Math.PI / 180) * distance), round(cy + y + Math.sin(normal * Math.PI / 180) * distance)];
    const [x1, y1] = along(-track.half), [x2, y2] = along(track.half);
    return <line key={minute} x1={x1} y1={y1} x2={x2} y2={y2} className={minute % 5 === 0 ? styles.hourTick : styles.tick} />;
  });
  const numerals = NUMERALS.map((text, hour) => {
    const { x, y } = onEdge(hour * 30, ring.hx, ring.hy, ring.r);
    return (
      <text key={text} transform={`translate(${round(cx + x)} ${round(cy + y)}) scale(.82 1.12)`} textAnchor="middle" dominantBaseline="central"
        className={styles.numeral} style={{ fontSize: numeral }}>{text}</text>
    );
  });
  const reach = (angle: number, hx: number, hy: number, r: number) => { const point = onEdge(angle, hx, hy, r); return Math.hypot(point.x, point.y); };
  const hourLength = round(reach(hours * 30, ring.hx, ring.hy, ring.r) - numeral * .75);
  const minuteLength = round(reach(minutes * 6, track.hx, track.hy, track.r) - track.half * 1.4);
  // One length all the way round: the shortest reach to the track, so the tip never crosses it or changes size.
  const secondLength = round(Math.min(track.hx, track.hy) - track.half * 1.4);

  const secondHand = (
    <g className={styles.second}>
      <line x1={cx} y1={cy + 90} x2={cx} y2={cy - secondLength} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={9} />
    </g>
  );

  return (
    <span ref={box} className={`${styles.face} ${inline ? styles.inline : ""}`} style={style} data-night={night || undefined} data-red={(night && settings.nightRed) || undefined}>
      <span className={styles.dial} aria-hidden="true" />
      <svg className={styles.marks} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        <defs>
          <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--hand) 70%, white)" }} />
            <stop offset=".5" style={{ stopColor: "var(--hand)" }} />
            <stop offset=".5" style={{ stopColor: "color-mix(in oklab, var(--hand) 78%, black)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--hand) 90%, black)" }} />
          </linearGradient>
        </defs>
        {rail(-track.half)}
        {rail(track.half)}
        {ticks}
        {numerals}
        {now > 0 && (
          <g className={styles.hands}>
            <path d={handPath(cx, cy, hourLength, 30, 36)} fill={`url(#${id}-hand)`} transform={`rotate(${hours * 30} ${cx} ${cy})`} />
            <path d={handPath(cx, cy, minuteLength, 20, 44)} fill={`url(#${id}-hand)`} transform={`rotate(${minutes * 6} ${cx} ${cy})`} />
            {settings.secondHand !== "off" && (sweep ? <SweepHand cx={cx} cy={cy}>{secondHand}</SweepHand> : <g transform={`rotate(${seconds * 6} ${cx} ${cy})`}>{secondHand}</g>)}
            <circle cx={cx} cy={cy} r={16} fill={`url(#${id}-hand)`} />
            <circle cx={cx} cy={cy} r={5} className={styles.cap} />
          </g>
        )}
      </svg>
    </span>
  );
}
