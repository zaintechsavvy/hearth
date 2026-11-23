"use client";

import useSWRInfinite from "swr/infinite";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import type { SearchResult, SearchType } from "@/lib/spotify/items";
import { fetchJson } from "./media-hooks";
import { MediaItems } from "./media-items";
import { SearchMessage } from "./search-message";
import styles from "./library.module.css";
import tile from "./media-tile.module.css";

const NOUNS: Record<SearchType, string> = { track: "songs", artist: "artists", album: "albums", playlist: "playlists" };

/** One kind of result, a page of Spotify's at a time. */
export function SearchList({ query, type, device, disabled, onOpen, onPlay }: {
  query: string; type: SearchType; device: MediaPlayerDevice; disabled: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void;
}) {
  const key = (index: number, previous: SearchResult | null) => !query || (previous && previous.next[type] == null) ? null
    : `/api/spotify/search?${new URLSearchParams({ q: query, type, offset: String(previous?.next[type] ?? 0) })}`;
  const { data, error, size, setSize, mutate, isValidating } = useSWRInfinite<SearchResult>(key, fetchJson, { revalidateOnFocus: false, revalidateFirstPage: false });
  if (error && !data?.length) return <SearchMessage title="Search did not work" text={error.message || "Spotify did not answer just now."} onRetry={() => void mutate()} />;
  if (!data) {
    return type === "track"
      ? <div className={tile.rows} role="status" aria-label="Searching">{[0, 1, 2, 3, 4].map(index => <span key={index} className={tile.skeletonRow} />)}</div>
      : <div className={styles.grid} role="status" aria-label="Searching">{[0, 1, 2, 3, 4, 5].map(index => <span key={index} className={styles.skeletonCover} data-round={type === "artist" || undefined} />)}</div>;
  }
  const seen = new Set<string>();
  const items = data.flatMap(page => page.sections[type] ?? []).filter(item => !seen.has(item.media.id) && seen.add(item.media.id));
  if (!items.length) return <SearchMessage title={`No ${NOUNS[type]} found for “${query}”`} text="Check the spelling, or try fewer words." />;
  const loadingMore = isValidating && size > data.length;
  return (
    <div className={styles.results}>
      <MediaItems items={items} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
      {error && <p className={tile.note}>{error.message || "The next page did not load."}</p>}
      {data.at(-1)?.next[type] != null && (
        <button type="button" className={`${tile.playAll} ${styles.more}`} data-quiet disabled={loadingMore} onClick={() => void setSize(size + 1)}>
          {loadingMore ? "Loading" : `More ${NOUNS[type]}`}
        </button>
      )}
    </div>
  );
}
