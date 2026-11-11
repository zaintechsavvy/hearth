"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { dialColorOf, type WallSettings } from "@/lib/wall";
import { SweepHand, useClockNow } from "./analog-face";
import styles from "./luxury-face.module.css";

const H = 1000;
const rad = (angle: number) => (angle - 90) * Math.PI / 180;

/** How far from the centre a ray at `angle` meets a rectangle `hx` wide by `hy` tall either side, so a mark or a hand fits the screen's shape rather than a circle. */
const toEdge = (angle: number, hx: number, hy: number) => {
  const cos = Math.abs(Math.cos(rad(angle))), sin = Math.abs(Math.sin(rad(angle)));
  return Math.min(cos > 1e-6 ? hx / cos : Infinity, sin > 1e-6 ? hy / sin : Infinity);
};

/** A tapered hand from just behind the centre to `length`, drawn pointing at 12. */
const handPath = (cx: number, cy: number, length: number, width: number, tail: number) =>
  `M ${cx - width / 2} ${cy + tail} L ${cx - width * .62} ${cy - length * .72} L ${cx} ${cy - length} L ${cx + width * .62} ${cy - length * .72} L ${cx + width / 2} ${cy + tail} Z`;

/**
 * A luxury dial shaped like the screen: a polished frame, a sunburst in the clock colour, applied batons that sit on
 * a rectangle (level at three and nine, diagonal in the corners), and hands that reach that rectangle at every angle.
 */
export function LuxuryFace({ night, settings, inline = false }: { night: boolean; settings: WallSettings; inline?: boolean }) {
  const now = useClockNow();
  const reduce = useReducedMotion();
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
  const inset = H * .085;
  const mx = cx - inset, my = cy - inset;
  const sweep = settings.secondHand === "smooth" && !reduce;
  const date = new Date(now);
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const red = night && settings.nightRed;
  const style = {
    "--dial": night ? "oklch(14% 0.01 250)" : dialColorOf(settings),
    ...(settings.handColor ? { "--metal": settings.handColor } : {}),
  } as CSSProperties;

  const at = (angle: number, distance: number) => [cx + distance * Math.cos(rad(angle)), cy + distance * Math.sin(rad(angle))] as const;
  const marker = (hour: number) => {
    const angle = hour * 30;
    const edge = toEdge(angle, mx, my);
    const long = hour % 3 === 0;
    const length = H * (long ? .1 : .075);
    const [x, y] = at(angle, edge - length / 2);
    const w = H * (hour === 0 ? .022 : .03);
    const body = (dx: number) => (
      <g key={dx}>
        <rect x={x - w / 2 + dx} y={y - length / 2} width={w} height={length} rx={3} className={styles.marker} />
        <rect x={x - w * .3 + dx} y={y - length / 2 + 8} width={w * .6} height={length - 16} rx={2} className={styles.lume} />
      </g>
    );
    return <g key={hour} transform={`rotate(${angle} ${x} ${y})`}>{hour === 0 ? [body(-w * .7), body(w * .7)] : body(0)}</g>;
  };
  const hourLength = toEdge(hours * 30, mx, my) * .58;
  const minuteLength = toEdge(minutes * 6, mx, my) * .9;
  const secondLength = Math.min(mx, my) * .96;
  const [dateX, dateY] = at(90, mx * .74);

  const secondHand = (
    <g className={styles.second}>
      <line x1={cx} y1={cy + 90} x2={cx} y2={cy - secondLength} strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy - secondLength * .8} r={13} className={styles.secondLume} />
      <circle cx={cx} cy={cy + 70} r={10} />
    </g>
  );

  return (
    <span ref={box} className={`${styles.face} ${inline ? styles.inline : ""}`} style={style} data-night={night || undefined} data-red={red || undefined}>
      <span className={styles.dial} aria-hidden="true" />
      <svg className={styles.marks} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        <defs>
          <linearGradient id="lux-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--metal) 60%, white)" }} />
            <stop offset=".45" style={{ stopColor: "var(--metal)" }} />
            <stop offset=".55" style={{ stopColor: "color-mix(in oklab, var(--metal) 72%, black)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--metal) 85%, white)" }} />
          </linearGradient>
        </defs>

        <rect x={inset * .45} y={inset * .45} width={W - inset * .9} height={H - inset * .9} rx={H * .05} className={styles.track} />
        {Array.from({ length: 60 }, (_, i) => {
          if (i % 5 === 0) return null;
          const angle = i * 6;
          const [x, y] = at(angle, toEdge(angle, mx + inset * .32, my + inset * .32));
          return <line key={i} x1={x} y1={y - 9} x2={x} y2={y + 9} transform={`rotate(${angle} ${x} ${y})`} className={styles.tick} />;
        })}
        {Array.from({ length: 12 }, (_, hour) => hour === 3 ? null : marker(hour))}

        <g className={styles.crown} transform={`translate(${cx} ${cy - my * .52}) scale(${H / 1000})`}>
          <path d="M -30 14 L -34 -14 L -18 0 L -8 -22 L 0 -2 L 8 -22 L 18 0 L 34 -14 L 30 14 Z" />
          <rect x={-30} y={18} width={60} height={7} rx={2} />
        </g>
        <text x={cx} y={cy - my * .52 + 64} textAnchor="middle" className={styles.small}>PERPETUAL · AUTOMATIC</text>
        <text x={cx} y={cy + my * .52} textAnchor="middle" className={styles.small}>SUPERLATIVE CHRONOMETER</text>

        <g transform={`translate(${dateX} ${dateY})`}>
          <rect x={-40} y={-30} width={80} height={60} rx={6} className={styles.window} />
          <text x={0} y={2} textAnchor="middle" dominantBaseline="central" className={styles.date}>{now ? date.getDate() : ""}</text>
          <circle r={56} className={styles.cyclops} />
        </g>

        {now > 0 && (
          <g className={styles.hands}>
            <g transform={`rotate(${hours * 30} ${cx} ${cy})`}>
              <path d={handPath(cx, cy, hourLength, 24, 40)} fill="url(#lux-metal)" />
              <circle cx={cx} cy={cy - hourLength * .7} r={30} className={styles.mercedes} />
              <path d={`M ${cx} ${cy - hourLength * .7} L ${cx} ${cy - hourLength * .7 - 30} M ${cx} ${cy - hourLength * .7} L ${cx - 26} ${cy - hourLength * .7 + 15} M ${cx} ${cy - hourLength * .7} L ${cx + 26} ${cy - hourLength * .7 + 15}`} className={styles.spokes} />
              <rect x={cx - 4} y={cy - hourLength * .55} width={8} height={hourLength * .35} rx={3} className={styles.lume} />
            </g>
            <g transform={`rotate(${minutes * 6} ${cx} ${cy})`}>
              <path d={handPath(cx, cy, minuteLength, 20, 50)} fill="url(#lux-metal)" />
              <rect x={cx - 4} y={cy - minuteLength * .82} width={8} height={minuteLength * .62} rx={3} className={styles.lume} />
            </g>
            {settings.secondHand !== "off" && (sweep ? <SweepHand cx={cx} cy={cy}>{secondHand}</SweepHand> : <g transform={`rotate(${seconds * 6} ${cx} ${cy})`}>{secondHand}</g>)}
            <circle cx={cx} cy={cy} r={18} fill="url(#lux-metal)" />
            <circle cx={cx} cy={cy} r={6} className={styles.cap} />
          </g>
        )}
      </svg>
    </span>
  );
}
