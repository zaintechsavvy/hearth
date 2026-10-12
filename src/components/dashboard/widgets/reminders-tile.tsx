"use client";

import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { glassClass } from "@/components/glass/glass";
import { addReminder, removeReminder, setReminderDone } from "@/lib/actions";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Reminder } from "@/lib/widgets/reminders";
import styles from "./reminders-tile.module.css";

const KEY = "/api/reminders";
const fetchReminders = async (url: string): Promise<Reminder[]> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Reminders are unavailable.");
  return response.json();
};

function dueText(dueAt: string) {
  const due = new Date(dueAt);
  const overdue = due.getTime() < Date.now();
  const sameDay = due.toDateString() === new Date().toDateString();
  const when = sameDay ? due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return { text: overdue ? `Overdue · ${when}` : when, overdue };
}

/** A household list: add with Enter, check off, and clear. Saved to Hearth, so every screen shows the same list. */
export function RemindersTile({ tile, interactive = true }: { tile: TileConfig; interactive?: boolean }) {
  const { data, error, mutate } = useSWR<Reminder[]>(KEY, fetchReminders);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (action: Promise<{ ok: boolean; error?: string }>, optimistic: Reminder[]) => {
    await mutate(async () => {
      const result = await action;
      setProblem(result.ok ? null : result.error ?? null);
      return fetchReminders(KEY);
    }, { optimisticData: optimistic, rollbackOnError: true });
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const text = title.trim();
    if (!text || !data) return;
    setTitle("");
    await run(addReminder({ title: text }), [{ id: `pending-${text}`, title: text, dueAt: null, doneAt: null }, ...data]);
  };

  const open = data?.filter(item => !item.doneAt).length ?? 0;
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Reminders">
      <header className={styles.header}>
        <h3 className={styles.heading}>Reminders</h3>
        {data && <span className={styles.count}>{open === 0 ? "All done" : `${open} to do`}</span>}
      </header>
      {error ? <p className={styles.muted}>{error.message}</p> : !data ? <Skeleton lines={3} label="Loading reminders" /> : (
        <ul className={styles.list}>
          {data.map(item => {
            const due = item.dueAt ? dueText(item.dueAt) : null;
            return (
              <li key={item.id} className={styles.item} data-done={item.doneAt ? true : undefined}>
                <Checkbox checked={Boolean(item.doneAt)} disabled={!interactive || item.id.startsWith("pending-")} aria-label={item.title}
                  onCheckedChange={checked => run(setReminderDone(item.id, checked === true), data.map(entry => entry.id === item.id ? { ...entry, doneAt: checked === true ? new Date().toISOString() : null } : entry))} />
                <span className={styles.text}>
                  <span className={styles.title}>{item.title}</span>
                  {due && !item.doneAt && <span className={styles.due} data-overdue={due.overdue || undefined}>{due.text}</span>}
                </span>
                {interactive && (
                  <button type="button" className={styles.remove} aria-label={`Remove ${item.title}`} onClick={() => run(removeReminder(item.id), data.filter(entry => entry.id !== item.id))}>
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {problem && <p className={styles.muted} role="alert">{problem}</p>}
      <form onSubmit={add} className={styles.form}>
        <input className={styles.input} value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a reminder" aria-label="New reminder" maxLength={200} disabled={!interactive} />
      </form>
    </section>
  );
}
