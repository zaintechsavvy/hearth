"use client";

import { ArrowDown, ArrowUp, DoorOpen, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit";
import { Input } from "@/components/arc/input/input";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { addRoom, removeRoom, renameRoom, reorderRooms } from "@/lib/actions";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

/** Every room Hearth shows: the ones you made and the ones your integrations reported, renamed, ordered, or removed here. */
export function RoomsSection() {
  const { home, refresh } = useHome();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rooms = home?.rooms ?? [];
  const counts = new Map<string, number>();
  for (const device of home?.devices ?? []) if (device.room) counts.set(device.room, (counts.get(device.room) ?? 0) + 1);

  const run = async (action: Promise<{ ok: boolean; error?: string }>) => {
    const result = await action;
    setError(result.ok ? null : result.error ?? "That did not work.");
    await refresh();
    return result.ok;
  };
  const move = (index: number, by: number) => {
    const next = [...rooms];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return run(reorderRooms(next));
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(addRoom(name))) setName("");
  };

  return (
    <SettingsSection id="rooms" title="Rooms" description={<>Rename, reorder, or add rooms. Changes stay in Hearth; Home Assistant keeps its areas. Move a device from its tile&apos;s Customize.</>}>
      <Glass shape="panel" className={styles.group}>
        {rooms.length === 0 && (
          <div className={styles.row}>
            <EmptyState className={styles.empty} icon={<DoorOpen size={24} strokeWidth={1.75} />} title="No rooms yet" description="Rooms come from your Home Assistant areas, or add your own below." />
          </div>
        )}
        {rooms.map((room, index) => (
          <div key={room} className={styles.row}>
            <div className={styles.rowText}>
              <InlineEdit variant="body" className={styles.rowTitle} label={`Rename ${room}`} value={room} onSave={async next => { if (!(await run(renameRoom(room, next)))) throw new Error("Rename failed"); }} validate={next => next.trim() ? null : "Give the room a name."} />
              <span className={styles.rowMeta}>{counts.get(room) ? `${counts.get(room)} ${counts.get(room) === 1 ? "device" : "devices"}` : "Empty"}</span>
            </div>
            <div className={styles.rowActions}>
              <Button variant="ghost" size="sm" aria-label={`Move ${room} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
              <Button variant="ghost" size="sm" aria-label={`Move ${room} down`} disabled={index === rooms.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
              <ConfirmMorph label="Remove" prompt={counts.get(room) ? `Move ${counts.get(room)} to no room?` : `Remove ${room}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => { await run(removeRoom(room)); }} />
            </div>
          </div>
        ))}
        <form className={styles.row} onSubmit={add}>
          <div className={styles.inline} style={{ flex: 1 }}>
            <Input label="New room" value={name} onChange={event => setName(event.target.value)} placeholder="Nursery" maxLength={40} error={error ?? undefined} />
            <Button type="submit" variant="secondary" disabled={!name.trim()}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add</Button>
          </div>
        </form>
      </Glass>
    </SettingsSection>
  );
}
