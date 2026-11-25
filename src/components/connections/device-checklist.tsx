"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { SearchField } from "@/components/arc/search-field/search-field";
import { groupByRoom, matchesSearch, searchTerms } from "@/lib/device-search";
import styles from "./device-checklist.module.css";

export interface ChecklistItem {
  id: string;
  name: string;
  room: string | null;
  /** What it is, as "Light" or "Door sensor"; searched, and shown under the name. */
  detail: string;
}

/** Ticks any number of devices from a long list: searchable by name, room, or type, grouped by room, each room ticked at once. */
export function DeviceChecklist({ label, items, chosen, onChange }: { label: string; items: ChecklistItem[]; chosen: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const picked = new Set(chosen);
  const rooms = useMemo(() => {
    const terms = searchTerms(query);
    return groupByRoom(items.filter(item => matchesSearch([item.name, item.room, item.detail], terms)).sort((a, b) => a.name.localeCompare(b.name)), item => item.room);
  }, [items, query]);
  const shown = rooms.reduce((count, [, list]) => count + list.length, 0);
  const set = (ids: string[], on: boolean) => onChange(on ? [...new Set([...chosen, ...ids])] : chosen.filter(id => !ids.includes(id)));

  return (
    <div className={styles.checklist}>
      {items.length > 6 && (
        <div className={styles.search}>
          <SearchField label="Search" value={query} onValueChange={setQuery} placeholder="Name, room, or type" autoComplete="off" enterKeyHint="search" />
          <span className={styles.count} aria-live="polite">{query ? `${shown} of ${items.length}` : `${items.filter(item => picked.has(item.id)).length} chosen`}</span>
        </div>
      )}
      <div className={styles.list} role="group" aria-label={label}>
        {rooms.length === 0 && (
          <div className={styles.empty}>
            <p>Nothing matches &ldquo;{query.trim()}&rdquo;.</p>
            <Button size="sm" variant="secondary" onClick={() => setQuery("")}>Clear search</Button>
          </div>
        )}
        {rooms.map(([room, list]) => {
          const ticked = list.filter(item => picked.has(item.id)).length;
          return (
            <section key={room} className={styles.room} aria-label={room}>
              <div className={styles.roomHead}>
                <Checkbox label={room} aria-label={`Every device in ${room}`} checked={ticked === list.length ? true : ticked ? "indeterminate" : false}
                  onCheckedChange={() => set(list.map(item => item.id), ticked !== list.length)} />
                <span className={styles.roomCount}>{ticked} of {list.length}</span>
              </div>
              {list.map(item => (
                <div key={item.id} className={styles.item}>
                  <Checkbox label={item.name} description={item.detail} checked={picked.has(item.id)} onCheckedChange={on => set([item.id], on === true)} />
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
