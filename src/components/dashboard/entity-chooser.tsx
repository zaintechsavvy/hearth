"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ScanSearch } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import type { TileColor, TileIcon } from "@/lib/dashboard/layout";
import { groupByRoom, matchesSearch, searchTerms } from "@/lib/device-search";
import { TILE_ICON_COMPONENTS } from "./tiles/tile-icons";
import type { Device } from "@/lib/devices/types";
import { useHome } from "./use-home";
import styles from "./entity-chooser.module.css";

export interface Candidate {
  id: string;
  name: string;
  room: string | null;
  detail: string;
  source: string;
  icon: TileIcon;
  color: TileColor;
  /** A settings or diagnostic entry; listed last and marked. */
  auxiliary?: boolean;
  available: boolean;
  /** Already on the dashboard somewhere. */
  placed?: boolean;
  /** More words it is found by, such as its name and room in the integration. */
  keywords?: (string | null | undefined)[];
}

interface EntityChooserProps {
  candidates: Candidate[];
  current?: string | null;
  onChoose: (id: string) => void;
  empty: string;
}

/** What someone flipping a device at the wall or in its own app changes, so identifying sees it whatever the integration reports. */
function stateOf(device: Device) {
  const read = (key: string) => (device as unknown as Record<string, unknown>)[key];
  return JSON.stringify(["on", "state", "active", "brightness", "position", "speed"].map(read));
}

/** Pick the one thing a tile shows, from every connection: searchable by name, room, type, or connection, and grouped by room. */
export function EntityChooser({ candidates, current, onChoose, empty }: EntityChooserProps) {
  const [query, setQuery] = useState("");
  const { home } = useHome();
  // While identifying, whatever changes after the start rises to the top: flip the light you mean and it shows up.
  const [identifying, setIdentifying] = useState<{ at: number; states: Map<string, string> } | null>(null);
  const changed = useMemo(() => {
    if (!identifying) return [];
    const devices = new Map((home?.devices ?? []).map(device => [device.id, device]));
    const when = (id: string) => { const at = devices.get(id)?.changedAt; return at ? Date.parse(at) : 0; };
    const moved = (id: string) => { const device = devices.get(id); return Boolean(device) && (when(id) > identifying.at || stateOf(device!) !== identifying.states.get(id)); };
    return candidates.filter(item => moved(item.id)).sort((a, b) => when(b.id) - when(a.id));
  }, [identifying, home?.devices, candidates]);
  const startIdentifying = () => setIdentifying({ at: Date.now(), states: new Map((home?.devices ?? []).map(device => [device.id, stateOf(device)])) });
  const identifiable = candidates.some(item => !item.id.includes("camera:") && !item.id.startsWith("scene:"));
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rooms = useMemo(() => {
    const terms = searchTerms(query);
    const matches = candidates.filter(item => matchesSearch([item.name, item.room, item.detail, item.source, ...(item.keywords ?? [])], terms));
    return groupByRoom(matches, item => item.room).map(([room, items]) => [room, items.sort((a, b) => Number(Boolean(a.auxiliary)) - Number(Boolean(b.auxiliary)) || a.name.localeCompare(b.name))] as const);
  }, [candidates, query]);
  const shown = rooms.reduce((count, [, items]) => count + items.length, 0);
  const options = () => [...(list.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
  // Down from the search goes into the results, the arrows move through them, and Enter in the search takes the first.
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); options()[0]?.focus(); }
    if (event.key === "Enter" && query.trim() && rooms[0]) { event.preventDefault(); onChoose(rooms[0][1][0].id); }
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = options();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to = event.key === "ArrowDown" ? at + 1 : event.key === "ArrowUp" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : null;
    if (to === null) return;
    event.preventDefault();
    if (to < 0) search.current?.focus();
    else all[Math.min(to, all.length - 1)]?.focus();
  };
  const row = (item: Candidate) => {
    const Icon = TILE_ICON_COMPONENTS[item.icon];
    return (
      <button key={item.id} type="button" role="option" aria-selected={item.id === current} className={styles.row} data-auxiliary={item.auxiliary || undefined} onClick={() => onChoose(item.id)}>
        <span className={styles.icon} data-color={item.color} aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
        <span className={styles.text}>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.meta}>{item.detail} · {item.source}</span>
        </span>
        <span className={styles.tags}>
          {item.id === current && <Badge tone="info" size="sm">Linked</Badge>}
          {item.placed && item.id !== current && <Badge size="sm">On dashboard</Badge>}
          {item.auxiliary && <Badge size="sm">Settings or diagnostics</Badge>}
          {!item.available && <Badge tone="warning" size="sm">Unavailable</Badge>}
        </span>
      </button>
    );
  };
  if (candidates.length === 0) return <p className={styles.empty}>{empty}</p>;

  return (
    <div className={styles.chooser}>
      {candidates.length > 6 && (
        <div className={styles.search}>
          <SearchField ref={search} label="Search" value={query} onValueChange={setQuery} onKeyDown={onSearchKey} placeholder="Name, room, area, or type" autoComplete="off" enterKeyHint="search" />
          <span className={styles.count} aria-live="polite">{query.trim() ? `${shown} of ${candidates.length}` : `${candidates.length}`}</span>
          {identifiable && (
            <Button size="sm" variant={identifying ? "primary" : "secondary"} aria-pressed={Boolean(identifying)} onClick={() => (identifying ? setIdentifying(null) : startIdentifying())}>
              <ScanSearch size={16} strokeWidth={1.75} aria-hidden="true" /> {identifying ? "Stop" : "Identify"}
            </Button>
          )}
        </div>
      )}
      {identifying && (
        <section className={styles.identify} aria-label="Just changed" aria-live="polite">
          {changed.length === 0
            ? <p className={styles.identifyHint}>Turn the one you want on or off, at the switch or in its own app. It shows up here.</p>
            : <><h3 className={styles.roomName}>Just changed</h3>{changed.map(item => row(item))}</>}
        </section>
      )}
      <div ref={list} className={styles.list} role="listbox" aria-label="Devices" onKeyDown={onListKey}>
        {rooms.length === 0 && (
          <div className={styles.empty}>
            <p>Nothing matches &ldquo;{query.trim()}&rdquo;. Try a room or a type, such as light.</p>
            <Button size="sm" variant="secondary" onClick={() => { setQuery(""); search.current?.focus(); }}>Clear search</Button>
          </div>
        )}
        {rooms.map(([room, items]) => (
          <section key={room} className={styles.room} aria-label={room}>
            <h3 className={styles.roomName}>{room}</h3>
            {items.map(item => row(item))}
          </section>
        ))}
      </div>
    </div>
  );
}
