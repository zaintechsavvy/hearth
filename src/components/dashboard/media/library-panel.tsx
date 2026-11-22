"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useState } from "react";
import { useHome } from "@/components/dashboard/use-home";
import { librariesFor, planPlay } from "@/lib/devices/speakers";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { LibraryBrowse } from "./library-browse";
import { LibrarySearch } from "./library-search";
import { useDebounced } from "./media-hooks";
import { OutputIcon } from "./output-icon";
import { ViewHead } from "./view-head";
import styles from "./media-tile.module.css";

/**
 * The music a player can reach: Spotify's library when the home has Spotify, otherwise the player's own. Picks play on
 * this player, through Spotify Connect when the library is Spotify's and this player is one of its speakers.
 */
export function LibraryPanel({ device, disabled, onBack, onOutputs }: { device: MediaPlayerDevice; disabled: boolean; onBack?: () => void; onOutputs?: () => void }) {
  const { home, send } = useHome();
  const libraries = librariesFor(device, home?.devices ?? []);
  const [chosen, setChosen] = useState<string | null>(null);
  const library = libraries.find(item => item.id === chosen) ?? libraries[0];
  const [trail, setTrail] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const searched = useDebounced(query.trim(), 300);
  const opened = trail.at(-1) ?? null;
  const where = device.group.length > 1 ? `${device.group.length} speakers` : device.output ?? device.name;

  if (!library) {
    return (
      <div className={styles.list}>
        <ViewHead title="Library" onBack={onBack} />
        <p className={styles.note}>{device.name} has no music library to browse. Add Spotify to Home Assistant and its playlists, albums, and artists show up here.</p>
      </div>
    );
  }

  const play = async (item: MediaItem, shuffle = false) => {
    const plan = planPlay(item, library, device);
    if ("error" in plan) return setNotice(plan.error);
    setNotice(null);
    try {
      if (shuffle && plan.to.can.shuffle) await send(plan.to, { type: "shuffle", on: true });
      await send(plan.to, plan.command);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : "That did not start just now. Try again in a moment.");
    }
  };
  const open = (item: MediaItem) => { setNotice(null); setTrail([...trail, item]); };
  const switchTo = (id: string) => { setChosen(id); setTrail([]); setQuery(""); setNotice(null); };

  return (
    <div className={styles.list} data-library>
      <ViewHead title={opened?.title ?? "Library"} onBack={opened ? () => setTrail(trail.slice(0, -1)) : onBack} backLabel={opened ? "Back" : undefined}>
        {onOutputs && (
          <button type="button" className={styles.target} aria-label={`Playing on ${where}. Choose where it plays`} disabled={disabled} onClick={onOutputs}>
            <OutputIcon name={device.output ?? device.name} size={14} />
            <span>{where}</span>
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </ViewHead>
      {!opened && libraries.length > 1 && (
        <div className={styles.sources} role="radiogroup" aria-label="Library">
          {libraries.map(item => (
            <button key={item.id} type="button" role="radio" aria-checked={item.id === library.id} className={styles.source} onClick={() => switchTo(item.id)}>
              {item.platform === "spotify" ? "Spotify" : item.name}
            </button>
          ))}
        </div>
      )}
      {!opened && library.can.search && (
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" className={styles.searchInput} value={query} onChange={event => setQuery(event.target.value)} disabled={disabled}
            placeholder="Songs, albums, artists, playlists" aria-label="Search music" enterKeyHint="search" autoComplete="off" spellCheck={false} />
          {query && <button type="button" className={styles.searchClear} aria-label="Clear the search" onClick={() => setQuery("")}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
        </label>
      )}
      {notice && <p className={styles.callout} role="alert">{notice}</p>}
      {!opened && query.trim()
        ? <LibrarySearch library={library} query={query.trim() === searched ? searched : ""} device={device} disabled={disabled} onOpen={open} onPlay={item => void play(item)} />
        : <LibraryBrowse key={`${library.id}:${opened?.media.id ?? ""}`} library={library} item={opened} device={device} disabled={disabled} onOpen={open} onPlay={(item, shuffle) => void play(item, shuffle)} />}
    </div>
  );
}
