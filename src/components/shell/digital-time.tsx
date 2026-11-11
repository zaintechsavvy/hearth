import type { CSSProperties } from "react";
import type { WallSettings } from "@/lib/wall";
import styles from "./digital-time.module.css";

/** The resting clock's digits, styled by the wall settings: side by side or stacked, at the chosen size. */
export function DigitalTime({ now, settings, className }: { now: number; settings: Pick<WallSettings, "digitLayout" | "digitScale">; className?: string }) {
  const parts = now ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(new Date(now)) : [];
  const hour = parts.find(part => part.type === "hour")?.value ?? "";
  const minute = parts.find(part => part.type === "minute")?.value ?? "";
  const period = parts.find(part => part.type === "dayPeriod")?.value ?? null;
  const style = { "--digit-scale": settings.digitScale } as CSSProperties;
  return (
    <span className={`${styles.time} ${className ?? ""}`} style={style} data-layout={settings.digitLayout}>
      {settings.digitLayout === "stacked" ? (
        <>
          <span className={styles.line}>{hour.padStart(2, "0")}</span>
          <span className={styles.line}>{minute}</span>
        </>
      ) : (
        <span className={styles.line}>{hour}:{minute}</span>
      )}
      {period && <span className={styles.period}>{period}</span>}
    </span>
  );
}
