"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import styles from "./room-picker.module.css";

const NO_ROOM = "__none";
const NEW_ROOM = "__new";

interface RoomPickerProps {
  rooms: string[];
  value: string | null;
  /** The integration's room, when Hearth moved the device elsewhere. */
  sourceRoom?: string | null;
  sourceLabel: string;
  /** Null restores the integration's room; an empty string means no room. */
  onChange: (room: string | null) => void;
}

/** Choose a room, make a new one on the spot, or go back to the integration's. */
export function RoomPicker({ rooms, value, sourceRoom, sourceLabel, onChange }: RoomPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const options = [...new Set([...rooms, ...(value ? [value] : [])])];

  const create = (event: FormEvent) => {
    event.preventDefault();
    const room = name.trim();
    if (!room) return;
    onChange(room);
    setName("");
    setCreating(false);
  };

  return (
    <div className={styles.picker}>
      <Select
        label="Room"
        value={creating ? NEW_ROOM : value ?? NO_ROOM}
        onValueChange={next => {
          if (next === NEW_ROOM) return setCreating(true);
          setCreating(false);
          onChange(next === NO_ROOM ? "" : next);
        }}
        options={[...options.map(room => ({ value: room, label: room })), { value: NO_ROOM, label: "No room" }, { value: NEW_ROOM, label: "New room…" }]}
      />
      {creating && (
        <form className={styles.create} onSubmit={create}>
          <Input label="New room" value={name} onChange={event => setName(event.target.value)} placeholder="Nursery, Garage, Patio" maxLength={40} autoFocus />
          <Button type="submit" variant="secondary" disabled={!name.trim()}>Add room</Button>
        </form>
      )}
      {sourceRoom !== undefined && (
        <p className={styles.source}>
          {sourceLabel} has it in {sourceRoom ?? "no room"}.
          <button type="button" className={styles.restore} onClick={() => onChange(null)}>Use that</button>
        </p>
      )}
    </div>
  );
}
