"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { faceColorOf, isLight, type WallSettings } from "@/lib/wall";
import { useBoxAspect } from "./use-box-aspect";
import styles from "./analog-face.module.css";

/** The dial on its side and standing up: the same hands, with the four numerals spread to suit the screen. */
const LAYOUTS = {
  landscape: { width: 1400, height: 984, cx: 700, cy: 490, numerals: [["12", 690, 282], ["3", 990, 492], ["6", 684, 744], ["9", 408, 492]] },
  portrait: { width: 984, height: 1400, cx: 492, cy: 700, numerals: [["12", 482, 380], ["3", 748, 702], ["6", 476, 1030], ["9", 232, 702]] },
} as const;

function Hand({ angle, from, to, width, className, cx, cy }: { angle: number; from: number; to: number; width: number; className: string; cx: number; cy: number }) {
  return <line className={className} x1={cx} y1={cy - from} x2={cx} y2={cy - to} strokeWidth={width} strokeLinecap="round" transform={`rotate(${angle} ${cx} ${cy})`} />;
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
export function AnalogFace({ night, settings, note }: { night: boolean; settings: WallSettings; note?: string | null }) {
  const now = useClockNow();
  const [box, aspect] = useBoxAspect<HTMLSpanElement>();
  const { width, height, cx, cy, numerals } = LAYOUTS[aspect < 1 ? "portrait" : "landscape"];
  const hand = { cx, cy };
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
    <span ref={box} className={styles.face} style={style} data-night={night || undefined} data-red={red || undefined}>
      <svg className={styles.dial} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        {numerals.map(([text, x, y]) => (
          <text key={text} className={styles.numeral} x={x} y={y} textAnchor="middle" dominantBaseline="central">{text}</text>
        ))}
        {now > 0 && (
          <g className={styles.hands}>
            <Hand {...hand} className={styles.neck} angle={hours * 30} from={0} to={52} width={8} />
            <Hand {...hand} className={styles.hand} angle={hours * 30} from={52} to={250} width={34} />
            <Hand {...hand} className={styles.neck} angle={minutes * 6} from={0} to={52} width={8} />
            <Hand {...hand} className={styles.hand} angle={minutes * 6} from={52} to={410} width={30} />
            {secondsMode === "tick" && <Hand {...hand} className={styles.second} angle={seconds * 6} from={-80} to={460} width={4} />}
            {secondsMode === "smooth" && <SweepHand cx={cx} cy={cy}><Hand {...hand} className={styles.second} angle={0} from={-80} to={460} width={4} /></SweepHand>}
            <circle className={styles.pin} cx={cx} cy={cy} r={16} />
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
