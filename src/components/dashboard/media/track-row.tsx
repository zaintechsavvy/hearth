import { Music, Play, X } from "lucide-react";
import type { Track } from "./media-hooks";
import styles from "./media-tile.module.css";

export function TrackRow({ track, onPlay, onRemove }: { track: Track; onPlay?: () => void; onRemove?: () => void }) {
  const body = (
    <>
      <span className={styles.rowIcon}>{onPlay ? <Play size={14} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" /> : <Music size={15} strokeWidth={1.75} aria-hidden="true" />}</span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{track.title}</span>
        {track.artist && <span className={styles.rowMeta}>{track.artist}</span>}
      </span>
    </>
  );
  return (
    <div className={styles.trackRow}>
      {onPlay ? <button type="button" className={styles.row} aria-label={`Play ${track.title}`} onClick={onPlay}>{body}</button> : <div className={styles.row} data-static>{body}</div>}
      {onRemove && <button type="button" className={styles.remove} aria-label={`Remove ${track.title} from favourites`} onClick={onRemove}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
    </div>
  );
}
