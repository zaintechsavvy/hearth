"use client";

import { useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { dialColorOf, type WallSettings } from "@/lib/wall";
import { SweepHand, useClockNow } from "./analog-face";
import styles from "./luxury-face.module.css";

const C = 500;
const polar = (angle: number, radius: number) => {
  const a = (angle - 90) * Math.PI / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)] as const;
};
const turn = (angle: number) => `rotate(${angle} ${C} ${C})`;

/** The hour hand's round "Mercedes" window: a ring near the tip with three spokes inside. */
const HOUR_HAND = `M ${C - 9} ${C + 40} L ${C - 11} ${C - 150} L ${C} ${C - 228} L ${C + 11} ${C - 150} L ${C + 9} ${C + 40} Z`;
const MINUTE_HAND = `M ${C - 8} ${C + 50} L ${C - 10} ${C - 280} L ${C} ${C - 352} L ${C + 10} ${C - 280} L ${C + 8} ${C + 50} Z`;

/** A luxury watch dial: a fluted bezel, a sunburst dial in the clock colour, applied batons, a date under a magnifier, and dauphine hands. The bezel and sunburst are CSS gradients, so a tablet paints a few layers rather than hundreds of lines. */
export function LuxuryFace({ night, settings, inline = false }: { night: boolean; settings: WallSettings; inline?: boolean }) {
  const now = useClockNow();
  const reduce = useReducedMotion();
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

  const secondHand = (
    <g className={styles.second}>
      <line x1={C} y1={C + 90} x2={C} y2={C - 380} strokeWidth={4} strokeLinecap="round" />
      <circle cx={C} cy={C - 300} r={13} className={styles.secondLume} />
      <circle cx={C} cy={C + 70} r={10} />
    </g>
  );

  return (
    <span className={`${styles.face} ${inline ? styles.inline : ""}`} style={style} data-night={night || undefined} data-red={red || undefined}>
      <span className={styles.watch}>
      <span className={styles.bezel} aria-hidden="true" />
      <span className={styles.rehaut} aria-hidden="true" />
      <span className={styles.dial} aria-hidden="true" />
      <svg className={styles.marks} viewBox="0 0 1000 1000" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        <defs>
          <linearGradient id="lux-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--metal) 60%, white)" }} />
            <stop offset=".45" style={{ stopColor: "var(--metal)" }} />
            <stop offset=".55" style={{ stopColor: "color-mix(in oklab, var(--metal) 72%, black)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--metal) 85%, white)" }} />
          </linearGradient>
        </defs>

        <g className={styles.track}>
          {Array.from({ length: 60 }, (_, i) => <line key={i} x1={C} y1={C - 424} x2={C} y2={C - (i % 5 ? 410 : 400)} strokeWidth={i % 5 ? 2 : 4} transform={turn(i * 6)} />)}
        </g>

        {Array.from({ length: 12 }, (_, hour) => {
          if (hour === 3) return null;
          const long = hour % 3 === 0;
          return (
            <g key={hour} transform={turn(hour * 30)}>
              {hour === 0 ? (
                <>
                  <rect x={C - 26} y={C - 392} width={20} height={88} rx={3} className={styles.marker} />
                  <rect x={C + 6} y={C - 392} width={20} height={88} rx={3} className={styles.marker} />
                  <rect x={C - 20} y={C - 384} width={8} height={60} rx={2} className={styles.lume} />
                  <rect x={C + 12} y={C - 384} width={8} height={60} rx={2} className={styles.lume} />
                </>
              ) : (
                <>
                  <rect x={C - 13} y={C - 392} width={26} height={long ? 92 : 72} rx={3} className={styles.marker} />
                  <rect x={C - 5} y={C - 384} width={10} height={long ? 70 : 52} rx={2} className={styles.lume} />
                </>
              )}
            </g>
          );
        })}

        <g className={styles.crown} transform={`translate(${C} ${C - 262})`}>
          <path d="M -30 14 L -34 -14 L -18 0 L -8 -22 L 0 -2 L 8 -22 L 18 0 L 34 -14 L 30 14 Z" />
          <rect x={-30} y={18} width={60} height={7} rx={2} />
        </g>
        <text x={C} y={C - 205} textAnchor="middle" className={styles.brand}>HEARTH</text>
        <text x={C} y={C - 176} textAnchor="middle" className={styles.small}>PERPETUAL · AUTOMATIC</text>
        <text x={C} y={C + 236} textAnchor="middle" className={styles.small}>SUPERLATIVE CHRONOMETER</text>

        <g transform={`translate(${polar(90, 330)[0]} ${C})`}>
          <rect x={-40} y={-30} width={80} height={60} rx={6} className={styles.window} />
          <text x={0} y={2} textAnchor="middle" dominantBaseline="central" className={styles.date}>{now ? date.getDate() : ""}</text>
          <circle r={56} className={styles.cyclops} />
        </g>

        {now > 0 && (
          <g className={styles.hands}>
            <g transform={turn(hours * 30)}>
              <path d={HOUR_HAND} fill="url(#lux-metal)" />
              <circle cx={C} cy={C - 168} r={34} className={styles.mercedes} />
              <path d={`M ${C} ${C - 168} L ${C} ${C - 202} M ${C} ${C - 168} L ${C - 29} ${C - 151} M ${C} ${C - 168} L ${C + 29} ${C - 151}`} className={styles.spokes} />
              <path d={`M ${C - 4} ${C - 60} L ${C - 4} ${C - 132} L ${C + 4} ${C - 132} L ${C + 4} ${C - 60} Z`} className={styles.lume} />
            </g>
            <g transform={turn(minutes * 6)}>
              <path d={MINUTE_HAND} fill="url(#lux-metal)" />
              <path d={`M ${C - 4} ${C - 70} L ${C - 4} ${C - 300} L ${C} ${C - 322} L ${C + 4} ${C - 300} L ${C + 4} ${C - 70} Z`} className={styles.lume} />
            </g>
            {settings.secondHand !== "off" && (sweep ? <SweepHand cx={C} cy={C}>{secondHand}</SweepHand> : <g transform={turn(seconds * 6)}>{secondHand}</g>)}
            <circle cx={C} cy={C} r={18} fill="url(#lux-metal)" />
            <circle cx={C} cy={C} r={6} className={styles.cap} />
          </g>
        )}
      </svg>
      </span>
    </span>
  );
}
