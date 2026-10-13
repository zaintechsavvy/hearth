"use client";

import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { glassClass } from "@/components/glass/glass";
import { deleteWidgetItem, saveWidgetItem } from "@/lib/widget-actions";
import { NOTE_COLORS, type ItemData } from "@/lib/widgets/items";
import type { HouseholdTileProps } from "./types";
import styles from "./household.module.css";
import own from "./notes-tile.module.css";

type NoteColor = ItemData<"note">["color"];
const TILT = [-1.6, 1.1, -0.6, 1.8, -1.2, 0.7];

/** A fridge door for the house: write a note, pick its colour, tear it off when it is done. */
export function NotesTile({ items, interactive, author }: HouseholdTileProps<"note"> & { author: string }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [error, setError] = useState<string | null>(null);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const result = await saveWidgetItem("note", { text, color, author });
    if (result.ok) setText("");
    setError(result.ok ? null : result.error);
  };
  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${own.board}`} aria-label="Note board">
      <header className={styles.header}>
        <h3 className={styles.title}>Notes</h3>
        <span className={styles.meta}>{items.length ? `${items.length} on the board` : "Nothing yet"}</span>
      </header>
      <ul className={own.notes}>
        {items.map((note, index) => (
          <li key={note.id} className={own.note} data-color={note.data.color} style={{ rotate: `${TILT[index % TILT.length]}deg` }}>
            <p className={own.text}>{note.data.text}</p>
            {note.data.author && <span className={own.author}>{note.data.author}</span>}
            {interactive && (
              <button type="button" className={own.remove} aria-label="Remove note" onClick={() => void deleteWidgetItem(note.id)}><X size={12} strokeWidth={1.75} aria-hidden="true" /></button>
            )}
          </li>
        ))}
      </ul>
      {interactive && (
        <form className={own.form} onSubmit={add}>
          <input className={own.input} value={text} onChange={event => setText(event.target.value)} placeholder="Leave a note" aria-label="New note" maxLength={280} />
          <button type="button" className={own.color} data-color={color} aria-label={`Note colour: ${color}. Change`} title="Change colour"
            onClick={() => setColor(NOTE_COLORS[(NOTE_COLORS.indexOf(color) + 1) % NOTE_COLORS.length])} />
          {error && <span className={styles.meta} role="alert">{error}</span>}
        </form>
      )}
    </section>
  );
}
