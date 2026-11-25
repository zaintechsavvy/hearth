"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useState } from "react";
import { useHome } from "@/components/dashboard/use-home";
import { playingOn, spotifyTargets, spotifyVia, wakeTarget } from "@/lib/devices/speakers";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { LibraryBrowse } from "./library-browse";
import { LibrarySearch } from "./library-search";
import { useDebounced, useSourceDevice } from "./media-hooks";
import { OutputIcon } from "./output-icon";
import { RecentShelf } from "./recent-shelf";
import { SpotifyPrompt } from "./spotify-prompt";
import { useSpeakerWake, useSpotifyStart } from "./use-spotify-start";
import { ViewHead } from "./view-head";
import { WakeStatus } from "./wake-status";
import styles from "./media-tile.module.css";

/** The home's Spotify, signed in from Hearth: recent plays, the library, and search. Picks play on this player through Spotify Connect. */
export function LibraryPanel({ device, disabled, onBack, onOutputs }: { device: MediaPlayerDevice; disabled: boolean; onBack?: () => void; onOutputs?: () => void }) {
  const { home } = useHome();
  const [trail, setTrail] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const { start, run, cancel } = useSpotifyStart();
  const searched = useDebounced(query.trim(), 280);
  const opened = trail.at(-1) ?? null;
  const where = playingOn(device);
  const source = useSourceDevice(device);
  const target = wakeTarget(source);
  const wake = useSpeakerWake(Boolean(home?.spotifyLinked && target));

  if (!home?.spotifyLinked) {
    return (
      <div className={styles.list}>
        <ViewHead title="Library" onBack={onBack} />
        <SpotifyPrompt />
      </div>
    );
  }

  const play = (item: MediaItem, shuffle = false) =>
    run("library", source, { media: item.media, speakers: spotifyTargets(source), device: target, shuffle }, { voice: Boolean(target) && spotifyVia(source, wake) === "voice", name: where });
  const open = (item: MediaItem) => setTrail([...trail, item]);

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
      {!opened && (
        <label className={styles.search}>
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" className={styles.searchInput} value={query} onChange={event => setQuery(event.target.value)} disabled={disabled}
            onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
            placeholder="What do you want to play?" aria-label="Search Spotify" enterKeyHint="search" autoComplete="off" spellCheck={false} />
          {query && <button type="button" className={styles.searchClear} aria-label="Clear the search" onClick={() => setQuery("")}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
        </label>
      )}
      {start && <WakeStatus start={start} onCancel={cancel} />}
      {!opened && query.trim()
        ? <LibrarySearch query={searched} device={device} disabled={disabled} onOpen={open} onPlay={item => void play(item)} />
        : (
          <>
            {!opened && <RecentShelf device={device} disabled={disabled} onOpen={open} onPlay={item => void play(item)} />}
            <LibraryBrowse key={opened?.media.id ?? ""} item={opened} device={device} disabled={disabled} onOpen={open} onPlay={(item, shuffle) => void play(item, shuffle)} />
          </>
        )}
    </div>
  );
}
