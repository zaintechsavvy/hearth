import type { MediaItem } from "@/lib/integrations/types";
import { MediaCard } from "./media-card";
import styles from "./library.module.css";

/** Covers in one row that scrolls sideways, for recent plays and search results. */
export function Shelf({ items, label, disabled, onOpen, onPlay }: { items: MediaItem[]; label: string; disabled?: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void }) {
  return (
    <div className={styles.shelf} role="list" aria-label={label}>
      {items.map(item => <div key={`${item.media.type}:${item.media.id}`} role="listitem" className={styles.shelfItem}><MediaCard item={item} disabled={disabled} onOpen={onOpen} onPlay={onPlay} /></div>)}
    </div>
  );
}
