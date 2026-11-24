import type { CSSProperties, ReactNode } from "react";
import type { WallSettings } from "@/lib/wall";
import { DigitalTime } from "./digital-time";
import styles from "./wall-mode.module.css";

/** The digital resting screen: the date over large digits, then whatever the screen adds under them. */
export function DigitalGlance({ now, settings, style, frame, align, children }: {
  now: number; settings: WallSettings; style?: CSSProperties; frame?: boolean; align?: WallSettings["frameClock"]; children?: ReactNode;
}) {
  return (
    <span className={styles.glance} style={style} data-frame={frame || undefined} data-align={align}>
      <span className={styles.date}>{now ? new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}</span>
      <DigitalTime now={now} settings={settings} className={styles.clock} />
      {children}
    </span>
  );
}
