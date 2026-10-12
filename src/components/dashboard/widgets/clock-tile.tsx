"use client";

import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import styles from "./clock-tile.module.css";
import { useMinute } from "./use-minute";

/** The time and date in the viewer's own locale. Rendered on the client only, so it never disagrees with the server. */
export function ClockTile({ tile }: { tile: TileConfig }) {
  const now = useMinute();
  const date = new Date(now ?? 0);
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Clock">
      {now === null ? null : (
        <>
          <time className={styles.time} dateTime={date.toISOString()}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
          <span className={styles.date}>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
        </>
      )}
    </section>
  );
}
