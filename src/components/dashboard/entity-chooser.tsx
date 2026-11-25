"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import type { TileColor, TileIcon } from "@/lib/dashboard/layout";
import { groupByRoom, matchesSearch, searchTerms } from "@/lib/device-search";
import { TILE_ICON_COMPONENTS } from "./tiles/tile-icons";
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

/** Pick the one thing a tile shows, from every connection: searchable by name, room, type, or connection, and grouped by room. */
export function EntityChooser({ candidates, current, onChoose, empty }: EntityChooserProps) {
  const [query, setQuery] = useState("");
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
  if (candidates.length === 0) return <p className={styles.empty}>{empty}</p>;

  return (
    <div className={styles.chooser}>
      {candidates.length > 6 && (
        <div className={styles.search}>
          <SearchField ref={search} label="Search" value={query} onValueChange={setQuery} onKeyDown={onSearchKey} placeholder="Name, room, area, or type" autoComplete="off" enterKeyHint="search" />
          <span className={styles.count} aria-live="polite">{query.trim() ? `${shown} of ${candidates.length}` : `${candidates.length}`}</span>
        </div>
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
            {items.map(item => {
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
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
