import { Disc3, ListMusic, Play, User } from "lucide-react";
import type { MediaItem } from "@/lib/integrations/types";
import styles from "./media-tile.module.css";

const KIND_ICONS = { track: Disc3, album: Disc3, artist: User, playlist: ListMusic, other: ListMusic };

/** An album, playlist, or artist as a cover: the cover opens it, and the round button on it plays it straight away. */
export function MediaCard({ item, disabled, onOpen, onPlay }: { item: MediaItem; disabled?: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void }) {
  const Icon = KIND_ICONS[item.kind];
  return (
    <div className={styles.coverCard} data-kind={item.kind}>
      <button type="button" className={styles.cardOpen} aria-label={`Open ${item.title}`} disabled={disabled} onClick={() => onOpen(item)}>
        <span className={styles.cardCover}>
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the music service as they are */}
          {item.artwork ? <img src={item.artwork} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <Icon size={28} strokeWidth={1.5} aria-hidden="true" />}
        </span>
        <span className={styles.cardTitle}>{item.title}</span>
        {item.subtitle && <span className={styles.cardMeta}>{item.subtitle}</span>}
      </button>
      {item.playable && (
        <button type="button" className={styles.cardPlay} aria-label={`Play ${item.title}`} disabled={disabled} onClick={() => onPlay(item)}>
          <Play size={16} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
