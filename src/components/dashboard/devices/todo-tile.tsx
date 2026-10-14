"use client";

import { Check, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { DeviceCommand, TodoDevice, TodoItem } from "@/lib/devices/types";
import styles from "./device-tiles.module.css";

const fetchItems = (url: string): Promise<TodoItem[]> => fetch(url).then(response => { if (!response.ok) throw new Error(); return response.json(); });

/** A Home Assistant list, such as the shopping list: add at the top, tick things off, and clear what is done. */
export function TodoTile({ device, config, interactive, onCommand }: { device: TodoDevice; config: TileConfig; interactive: boolean; onCommand: (command: DeviceCommand) => Promise<void> }) {
  const { data, mutate } = useSWR<TodoItem[]>(`/api/devices/${encodeURIComponent(device.id)}/todo?open=${device.open}`, fetchItems, { keepPreviousData: true });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const items = data ?? [];
  const open = items.filter(item => !item.done), done = items.filter(item => item.done);
  const run = async (command: Extract<DeviceCommand, { type: "todo" }>, next: TodoItem[]) => {
    setError(null);
    await mutate(next, { revalidate: false });
    await onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The list did not update."));
    await mutate();
  };
  const add = () => {
    const item = draft.trim();
    if (!item) return;
    setDraft("");
    void run({ type: "todo", action: "add", item }, [{ uid: `pending-${item}`, summary: item, done: false }, ...items]);
  };
  const name = config.label?.trim() || device.name;
  return (
    <section className={`${glassClass("panel")} ${styles.card} ${styles.list}`} data-size={config.size} aria-label={name}>
      <header className={styles.head}>
        <span className={styles.badge} aria-hidden="true"><ShoppingCart size={18} strokeWidth={1.75} /></span>
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>{error ?? (open.length ? `${open.length} to get` : "All done")}</span>
        </span>
      </header>
      {device.can.add && (
        <form className={styles.addRow} onSubmit={event => { event.preventDefault(); add(); }}>
          <input className={styles.addInput} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Add an item" aria-label={`Add to ${name}`} disabled={!interactive} maxLength={200} />
          <button type="submit" className={styles.round} disabled={!interactive || !draft.trim()} aria-label="Add"><Plus size={16} strokeWidth={1.75} aria-hidden="true" /></button>
        </form>
      )}
      <ul className={styles.items}>
        {open.map(item => (
          <li key={item.uid}>
            <button type="button" className={styles.item} disabled={!interactive || !device.can.check || item.uid.startsWith("pending-")} onClick={() => void run({ type: "todo", action: "check", item: item.uid }, items.map(entry => entry.uid === item.uid ? { ...entry, done: true } : entry))}>
              <span className={styles.box} aria-hidden="true" /><span className={styles.itemText}>{item.summary}</span>
            </button>
          </li>
        ))}
        {done.map(item => (
          <li key={item.uid}>
            <button type="button" className={styles.item} data-done disabled={!interactive || !device.can.check} onClick={() => void run({ type: "todo", action: "uncheck", item: item.uid }, items.map(entry => entry.uid === item.uid ? { ...entry, done: false } : entry))}>
              <span className={styles.box} data-on aria-hidden="true"><Check size={12} strokeWidth={2.25} /></span><span className={styles.itemText}>{item.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      {done.length > 0 && device.can.remove && interactive && (
        <button type="button" className={styles.clear} onClick={() => { for (const item of done) void onCommand({ type: "todo", action: "remove", item: item.uid }); void mutate(open, { revalidate: true }); }}>Clear {done.length} done</button>
      )}
    </section>
  );
}
