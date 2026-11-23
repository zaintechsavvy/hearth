import { Disc3, ListMusic, Music, Play, User } from "lucide-react";
import type { MediaItem } from "@/lib/integrations/types";
import styles from "./library.module.css";

const KIND = { track: ["Song", Music], album: ["Album", Disc3], artist: ["Artist", User], playlist: ["Playlist", ListMusic], other: ["", Music] } as const;

/** The search's best match, large: tapping a song plays it, tapping anything else opens it. */
export function TopResult({ item, disabled, onOpen, onPlay }: { item: MediaItem; disabled?: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void }) {
  const [label, Icon] = KIND[item.kind];
  const opens = item.expandable && item.kind !== "track";
  return (
    <div className={styles.top} data-kind={item.kind}>
      <button type="button" className={styles.topOpen} aria-label={`${opens ? "Open" : "Play"} ${item.title}`} disabled={disabled} onClick={() => (opens ? onOpen(item) : onPlay(item))}>
        <span className={styles.topCover}>
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from Spotify as they are */}
          {item.artwork ? <img src={item.artwork} alt="" referrerPolicy="no-referrer" /> : <Icon size={32} strokeWidth={1.5} aria-hidden="true" />}
        </span>
        <span className={styles.topTitle}>{item.title}</span>
        <span className={styles.topMeta}>
          {label && <span className={styles.topKind}>{label}</span>}
          {item.subtitle && <span className={styles.topBy}>{item.subtitle}</span>}
        </span>
      </button>
      {item.playable && (
        <button type="button" className={styles.topPlay} aria-label={`Play ${item.title}`} disabled={disabled} onClick={() => onPlay(item)}>
          <Play size={20} strokeWidth={0} fill="currentColor" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
