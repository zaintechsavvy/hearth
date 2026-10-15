import type { ReactNode } from "react";
import level from "./level-tile.module.css";

/**
 * A tall slider's words, drawn twice and cut at the fill line: light over the empty part, dark over the fill, so they
 * read at any level in light and dark themes alike.
 */
export function LevelOverlay({ shown, children }: { shown: number; children: ReactNode }) {
  return (
    <>
      <span className={level.overlay} style={{ clipPath: `inset(0 0 ${shown}% 0)` }}>{children}</span>
      <span className={level.overlay} data-filled aria-hidden="true" style={{ clipPath: `inset(${100 - shown}% 0 0 0)` }}>{children}</span>
    </>
  );
}
