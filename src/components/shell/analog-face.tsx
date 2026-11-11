"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { faceColorOf, isLight, type WallSettings } from "@/lib/wall";
import styles from "./analog-face.module.css";

const CX = 700;
const CY = 490;
const NUMERALS: [string, number, number][] = [["12", 690, 282], ["3", 990, 492], ["6", 684, 744], ["9", 408, 492]];

function Hand({ angle, from, to, width, className }: { angle: number; from: number; to: number; width: number; className: string }) {
  return <line className={className} x1={CX} y1={CY - from} x2={CX} y2={CY - to} strokeWidth={width} strokeLinecap="round" transform={`rotate(${angle} ${CX} ${CY})`} />;
}

/** A seconds hand that turns once a minute on a CSS animation, started where the second is now, so it glides instead of ticking. */
export function SweepHand({ children, cx, cy, className }: { children: ReactNode; cx: number; cy: number; className?: string }) {
  const [delay] = useState(() => -(Date.now() % 60_000) / 1000);
  return <g className={`${styles.sweep} ${className ?? ""}`} style={{ animationDelay: `${delay}s`, transformOrigin: `${cx}px ${cy}px` }}>{children}</g>;
}

/** The time, a second at a time, for a clock face; zero until mounted so the first render matches the server. */
export function useClockNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** An analog resting face: four large numerals that overlap at the middle, white hands over them, and the day in the corner. */
export function AnalogFace({ night, settings, note, inline = false }: { night: boolean; settings: WallSettings; note?: string | null; inline?: boolean }) {
  const now = useClockNow();
  const reduce = useReducedMotion();
  const secondsMode = settings.secondHand === "smooth" && reduce ? "tick" : settings.secondHand;

  const date = new Date(now);
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const red = night && settings.nightRed;
  const face = faceColorOf(settings);
  const style = {
    "--face": night ? "oklch(9% 0.004 260)" : face,
    "--ink": isLight(face) ? "oklch(18% 0.04 255)" : "oklch(95% 0.01 255)",
    ...(settings.handColor ? { "--hand": settings.handColor } : {}),
  } as CSSProperties;
  const day = now ? `${date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} ${date.getDate()}` : "";

  return (
    <span className={`${styles.face} ${inline ? styles.inline : ""}`} style={style} data-night={night || undefined} data-red={red || undefined}>
      <svg className={styles.dial} viewBox="0 0 1400 984" preserveAspectRatio="xMidYMid meet" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        {NUMERALS.map(([text, x, y]) => (
          <text key={text} className={styles.numeral} x={x} y={y} textAnchor="middle" dominantBaseline="central">{text}</text>
        ))}
        {now > 0 && (
          <g className={styles.hands}>
            <Hand className={styles.neck} angle={hours * 30} from={0} to={52} width={8} />
            <Hand className={styles.hand} angle={hours * 30} from={52} to={250} width={34} />
            <Hand className={styles.neck} angle={minutes * 6} from={0} to={52} width={8} />
            <Hand className={styles.hand} angle={minutes * 6} from={52} to={410} width={30} />
            {secondsMode === "tick" && <Hand className={styles.second} angle={seconds * 6} from={-80} to={460} width={4} />}
            {secondsMode === "smooth" && <SweepHand cx={CX} cy={CY}><Hand className={styles.second} angle={0} from={-80} to={460} width={4} /></SweepHand>}
            <circle className={styles.pin} cx={CX} cy={CY} r={16} />
          </g>
        )}
      </svg>
      <span className={styles.corner}>
        <span>{day}</span>
        {note && <span className={styles.note}>{note}</span>}
      </span>
    </span>
  );
}
