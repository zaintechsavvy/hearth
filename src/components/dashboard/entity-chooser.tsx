"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { SearchField } from "@/components/arc/search-field/search-field";
import type { TileColor, TileIcon } from "@/lib/dashboard/layout";
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
}

interface EntityChooserProps {
  candidates: Candidate[];
  current?: string | null;
  onChoose: (id: string) => void;
  empty: string;
}

/** Pick the one thing a tile shows, from every connection, grouped by room. */
export function EntityChooser({ candidates, current, onChoose, empty }: EntityChooserProps) {
  const [query, setQuery] = useState("");
  const rooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = candidates.filter(item => !needle || `${item.name} ${item.room ?? ""} ${item.detail} ${item.source}`.toLowerCase().includes(needle));
    const byRoom = new Map<string, Candidate[]>();
    for (const item of matches) byRoom.set(item.room ?? "No room", [...(byRoom.get(item.room ?? "No room") ?? []), item]);
    return [...byRoom.entries()]
      .sort(([a], [b]) => a === "No room" ? 1 : b === "No room" ? -1 : a.localeCompare(b))
      .map(([room, items]) => [room, items.sort((a, b) => Number(Boolean(a.auxiliary)) - Number(Boolean(b.auxiliary)) || a.name.localeCompare(b.name))] as const);
  }, [candidates, query]);

  if (candidates.length === 0) return <p className={styles.empty}>{empty}</p>;

  return (
    <div className={styles.chooser}>
      {candidates.length > 6 && <SearchField label="Search" value={query} onValueChange={setQuery} placeholder="Name, room, or type" />}
      <div className={styles.list} role="listbox" aria-label="Devices">
        {rooms.length === 0 && <p className={styles.empty}>Nothing matches that search.</p>}
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
