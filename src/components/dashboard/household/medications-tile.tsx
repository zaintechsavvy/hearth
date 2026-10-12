"use client";

import { Check, Settings2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { setDoseTaken } from "@/lib/widget-actions";
import { daysOfSupply, doseSlots, type DoseSlot } from "@/lib/widgets/schedules";
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./household.module.css";
import own from "./medications-tile.module.css";

const REFILL_DAYS = 7;
const timeLabel = (slot: DoseSlot) => slot.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Today's doses for everyone at home: tap a time to mark it taken, and see what is due, missed, or running low. */
export function MedicationsTile({ tile, items, interactive, onManage }: HouseholdTileProps<"medication">) {
  const now = useMinute();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  if (items.length === 0) return <SetupTile icon="pill" title="Add a medication" hint="Doses, times, and refills" tone="#ec4899" onClick={() => onManage()} interactive={interactive} />;

  const date = new Date(now ?? 0);
  const rows = items.map(item => ({ item, slots: now === null ? [] : doseSlots(item.data, date) })).filter(row => row.slots.length || tile.size !== "2x2");
  const all = rows.flatMap(row => row.slots.map(slot => ({ slot, item: row.item })));
  const next = all.filter(entry => entry.slot.state === "due" || entry.slot.state === "upcoming").sort((a, b) => a.slot.at.getTime() - b.slot.at.getTime())[0];
  const missed = all.filter(entry => entry.slot.state === "missed").length;

  const toggle = async (id: string, slot: DoseSlot) => {
    const key = `${id} ${slot.key}`;
    const taken = !(pending[key] ?? slot.state === "taken");
    setPending(current => ({ ...current, [key]: taken }));
    const result = await setDoseTaken(id, slot.key, taken);
    if (!result.ok) setPending(current => ({ ...current, [key]: !taken }));
  };

  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} aria-label="Medications">
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Medications</h3>
          <p className={styles.meta}>
            {missed ? `${missed} missed today` : next ? `Next: ${next.item.data.name} at ${timeLabel(next.slot)}` : all.length ? "All done for today" : "Nothing due today"}
          </p>
        </div>
        {interactive && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="Edit medications"><Settings2 size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
      </header>
      <ul className={styles.list}>
        {rows.map(({ item, slots }) => {
          const supply = daysOfSupply(item.data);
          return (
            <li key={item.id} className={own.row} style={{ "--med": item.data.color } as CSSProperties}>
              <span className={own.dot} aria-hidden="true" />
              <span className={own.text}>
                <span className={own.name}>{item.data.name}{item.data.dose && <span className={own.dose}> · {item.data.dose}</span>}</span>
                <span className={own.sub}>
                  {item.data.person && <span>{item.data.person}</span>}
                  {supply !== null && supply <= REFILL_DAYS && <span className={own.refill}>{supply === 0 ? "Out, refill now" : `Refill soon · ${supply} ${supply === 1 ? "day" : "days"} left`}</span>}
                  {slots.length === 0 && <span>Not today</span>}
                </span>
              </span>
              <span className={own.slots}>
                {slots.map(slot => {
                  const taken = pending[`${item.id} ${slot.key}`] ?? slot.state === "taken";
                  const state = taken ? "taken" : slot.state;
                  return (
                    <button key={slot.key} type="button" className={own.slot} data-state={state} disabled={!interactive} aria-pressed={taken}
                      aria-label={`${item.data.name} at ${timeLabel(slot)}, ${taken ? "taken" : state}`} onClick={() => void toggle(item.id, slot)}>
                      {taken && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                      {timeLabel(slot)}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
