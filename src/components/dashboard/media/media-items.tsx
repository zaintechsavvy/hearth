import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { FolderTile } from "./folder-tile";
import { MediaCard } from "./media-card";
import { MediaRow } from "./media-row";
import styles from "./media-tile.module.css";

interface Props {
  items: MediaItem[];
  /** The player, to mark what it is playing now. */
  device: MediaPlayerDevice;
  disabled?: boolean;
  onOpen: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

const isFolder = (item: MediaItem) => item.kind === "other" && item.expandable && !item.artwork && !item.playable;
const isCard = (item: MediaItem) => item.expandable && item.kind !== "track" && !isFolder(item);

/** Folders as tiles, albums, playlists, and artists as covers, and songs as rows, in that order. */
export function MediaItems({ items, device, disabled, onOpen, onPlay }: Props) {
  const folders = items.filter(isFolder), cards = items.filter(isCard), rows = items.filter(item => !isFolder(item) && !isCard(item));
  const playing = (item: MediaItem) => device.media?.id === item.media.id || (item.kind === "track" && Boolean(device.title) && item.title === device.title);
  return (
    <>
      {folders.length > 0 && <div className={styles.folders}>{folders.map(item => <FolderTile key={item.media.id} item={item} disabled={disabled} onOpen={onOpen} />)}</div>}
      {cards.length > 0 && <div className={styles.cards}>{cards.map(item => <MediaCard key={`${item.media.type}:${item.media.id}`} item={item} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />)}</div>}
      {rows.length > 0 && (
        <div className={styles.rows}>
          {rows.map(item => <MediaRow key={`${item.media.type}:${item.media.id}`} item={item} playing={playing(item)} paused={device.state !== "playing"} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />)}
        </div>
      )}
    </>
  );
}
