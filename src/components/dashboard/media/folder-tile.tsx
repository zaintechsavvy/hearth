import { ChevronRight, Clock, Disc3, Folder, LayoutGrid, ListMusic, Mic2, Music, Radio, Sparkles, TrendingUp, User } from "lucide-react";
import type { MediaItem } from "@/lib/integrations/types";
import styles from "./media-tile.module.css";

/** Spotify and Music Assistant name their top folders in plain words, so the icon follows the name. */
const ICONS: [RegExp, typeof Folder][] = [
  [/recent/i, Clock], [/top/i, TrendingUp], [/playlist/i, ListMusic], [/album/i, Disc3], [/artist/i, User], [/podcast|show|episode|audiobook/i, Mic2],
  [/radio|station/i, Radio], [/featured|new|release|made for/i, Sparkles], [/categor|genre|mood/i, LayoutGrid], [/track|song|liked|music/i, Music],
];

export function FolderTile({ item, disabled, onOpen }: { item: MediaItem; disabled?: boolean; onOpen: (item: MediaItem) => void }) {
  const Icon = ICONS.find(([pattern]) => pattern.test(item.title))?.[1] ?? Folder;
  return (
    <button type="button" className={styles.folder} disabled={disabled} onClick={() => onOpen(item)}>
      <span className={styles.folderIcon}><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className={styles.folderName}>{item.title}</span>
      <ChevronRight size={16} strokeWidth={1.75} className={styles.rowChevron} aria-hidden="true" />
    </button>
  );
}
