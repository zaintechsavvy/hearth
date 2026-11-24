"use client";

import type { CSSProperties } from "react";
import { LANDSCAPE_GRID, litCells, PORTRAIT_GRID, wordTime } from "@/lib/word-clock";
import type { WallSettings } from "@/lib/wall";
import { useClockNow } from "./analog-face";
import { useBoxAspect } from "./use-box-aspect";
import styles from "./word-face.module.css";

/** A word clock filling the screen: a grid of letters with the time lit in words to five minutes, and a dot in a corner for each minute past. */
export function WordFace({ night, settings }: { night: boolean; settings: WallSettings }) {
  const now = useClockNow();
  const [box, aspect] = useBoxAspect<HTMLSpanElement>();
  const grid = aspect < 1 ? PORTRAIT_GRID : LANDSCAPE_GRID;
  const time = now ? wordTime(new Date(now)) : null;
  const lit = litCells(grid, time?.words ?? []);
  const style = { "--columns": grid.rows[0].length, "--rows": grid.rows.length } as CSSProperties;
  return (
    <span ref={box} className={styles.face} style={style} data-red={(night && settings.nightRed) || undefined} role="img"
      aria-label={now ? new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
      <span className={styles.grid} aria-hidden="true">
        {grid.rows.flatMap((row, r) => [...row].map((letter, c) => <span key={`${r}:${c}`} className={styles.letter} data-lit={lit.has(`${r}:${c}`) || undefined}>{letter}</span>))}
      </span>
      {[0, 1, 2, 3].map(corner => <span key={corner} className={styles.dot} data-corner={corner} data-lit={(time && corner < time.extra) || undefined} aria-hidden="true" />)}
    </span>
  );
}
