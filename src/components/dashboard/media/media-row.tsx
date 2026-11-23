import { ChevronRight, Disc3, ListMusic, Music, Play, User } from "lucide-react";
import type { MediaItem } from "@/lib/integrations/types";
import { clock } from "./media-hooks";
import { PlayingBars } from "./playing-bars";
import styles from "./media-tile.module.css";

const KIND_ICONS = { track: Music, album: Disc3, artist: User, playlist: ListMusic, other: Music };

/** A song, or anything else in a list: tapping a song plays it, tapping an album or playlist opens it. */
export function MediaRow({ item, playing, paused, disabled, onOpen, onPlay }: { item: MediaItem; playing?: boolean; paused?: boolean; disabled?: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void }) {
  const opens = item.expandable && item.kind !== "track";
  const Icon = KIND_ICONS[item.kind];
  const body = (
    <>
      <span className={styles.rowIcon} data-art={item.artwork ? true : undefined} data-round={item.kind === "artist" || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the music service as they are */}
        {item.artwork ? <img src={item.artwork} alt="" className={styles.rowArt} referrerPolicy="no-referrer" loading="lazy" />
          : !opens && item.playable ? <Play size={14} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" />
          : <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{item.title}</span>
        {item.subtitle && <span className={styles.rowMeta}>{item.subtitle}</span>}
      </span>
      {playing ? <PlayingBars paused={Boolean(paused)} />
        : opens ? <ChevronRight size={18} strokeWidth={1.75} className={styles.rowChevron} aria-hidden="true" />
        : item.duration ? <span className={styles.rowTime}>{clock(item.duration)}</span> : null}
    </>
  );
  if (opens) return <button type="button" className={styles.row} aria-label={`Open ${item.title}`} disabled={disabled} onClick={() => onOpen(item)}>{body}</button>;
  if (item.playable) return <button type="button" className={styles.row} data-current={playing || undefined} aria-label={`Play ${item.title}`} disabled={disabled} onClick={() => onPlay(item)}>{body}</button>;
  return <div className={styles.row} data-static>{body}</div>;
}
