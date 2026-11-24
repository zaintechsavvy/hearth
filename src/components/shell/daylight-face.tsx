"use client";

import type { CSSProperties } from "react";
import { sunProgress } from "@/lib/daylight";
import type { WallSettings } from "@/lib/wall";
import { useClockNow } from "./analog-face";
import { DigitalTime } from "./digital-time";
import { useBoxAspect } from "./use-box-aspect";
import styles from "./daylight-face.module.css";

const H = 1000;
const round = (value: number) => Math.round(value * 100) / 100;
const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const span = (minutes: number) => {
  const hours = Math.floor(minutes / 60), mins = Math.round(minutes % 60);
  return hours ? `${hours} h ${mins} min` : `${mins} min`;
};
/** Today at `hours`, standing in for sunrise and sunset until the home's location is known. */
const today = (now: number, hours: number) => { const date = new Date(now); date.setHours(hours, 0, 0, 0); return date; };

/**
 * The day as a horizon across the screen: the sun on its arc from sunrise to sunset, below the horizon through the
 * night, with the time under the arch and sunrise and sunset in the lower corners.
 */
export function DaylightFace({ night, settings, sun }: { night: boolean; settings: WallSettings; sun: { sunrise: string; sunset: string } | null }) {
  const now = useClockNow();
  const [box, aspect] = useBoxAspect<HTMLSpanElement>();
  const W = Math.round(H * aspect);
  const portrait = aspect < 1;
  const horizon = H * (portrait ? .6 : .68);
  const cx = W / 2, rx = W * (portrait ? .4 : .41), ry = horizon - H * (portrait ? .2 : .12), below = H * .13;
  const rise = sun ? new Date(sun.sunrise) : today(now, 6), set = sun ? new Date(sun.sunset) : today(now, 18);
  const position = sunProgress(new Date(now), rise, set);
  const angle = Math.PI * position.progress;
  const x = position.up ? cx - rx * Math.cos(angle) : cx + rx * Math.cos(angle);
  const y = position.up ? horizon - ry * Math.sin(angle) : horizon + below * Math.sin(angle);
  const day = `M ${round(cx - rx)} ${horizon} A ${round(rx)} ${round(ry)} 0 0 1 ${round(cx + rx)} ${horizon}`;
  const dark = `M ${round(cx + rx)} ${horizon} A ${round(rx)} ${round(below)} 0 0 1 ${round(cx - rx)} ${horizon}`;
  const style = { "--sun-x": `${(x / W) * 100}%`, "--sun-y": `${(y / H) * 100}%`, "--horizon": `${(horizon / H) * 100}%` } as CSSProperties;

  return (
    <span ref={box} className={styles.face} style={style} data-up={(now > 0 && position.up) || undefined} data-red={(night && settings.nightRed) || undefined}>
      <svg className={styles.sky} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1={0} y1={horizon} x2={W} y2={horizon} className={styles.horizon} />
        <path d={day} className={styles.path} />
        <path d={dark} className={`${styles.path} ${styles.night}`} />
        {now > 0 && (
          <>
            <path d={position.up ? day : dark} pathLength={1} strokeDasharray={`${round(position.progress)} 1`} className={position.up ? styles.travelled : `${styles.travelled} ${styles.night}`} />
            {position.up && <circle cx={round(x)} cy={round(y)} r={H * .07} className={styles.glow} />}
            <circle cx={round(x)} cy={round(y)} r={H * (position.up ? .026 : .018)} className={position.up ? styles.sun : styles.moon} />
          </>
        )}
        <line x1={round(cx - rx)} y1={horizon - 14} x2={round(cx - rx)} y2={horizon + 14} className={styles.end} />
        <line x1={round(cx + rx)} y1={horizon - 14} x2={round(cx + rx)} y2={horizon + 14} className={styles.end} />
      </svg>
      <span className={styles.time}>
        <span className={styles.date}>{now ? new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}</span>
        <DigitalTime now={now} settings={{ digitLayout: "inline", digitScale: 1 }} className={styles.digits} />
      </span>
      {now > 0 && (
        <span className={styles.foot}>
          <span>{sun && <><span className={styles.label}>Sunrise</span> {clock(rise)}</>}</span>
          <span className={styles.left}>{!sun ? "Set the home's location to follow the sun" : position.up ? `${span(position.left)} of daylight left` : `Sunrise in ${span(position.left)}`}</span>
          <span>{sun && <><span className={styles.label}>Sunset</span> {clock(set)}</>}</span>
        </span>
      )}
    </span>
  );
}
