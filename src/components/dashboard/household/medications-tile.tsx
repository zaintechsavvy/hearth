"use client";

import { Check, Settings2 } from "lucide-react";
import type { CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { setDoseTaken } from "@/lib/widget-actions";
import { daysOfSupply, doseSlots, type DoseSlot } from "@/lib/widgets/schedules";
import type { WidgetItem } from "@/lib/widgets/items";
import { useHome } from "../use-home";
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./household.module.css";
import own from "./medications-tile.module.css";

const REFILL_DAYS = 7;
const ORDER: Record<DoseSlot["state"], number> = { missed: 0, due: 1, upcoming: 2, taken: 3 };
const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function status(slot: DoseSlot) {
  if (slot.state === "taken") return slot.takenAt ? `Taken at ${clock(new Date(slot.takenAt))}` : "Taken";
  if (slot.state === "missed") return "Missed";
  if (slot.state === "due") return "Due now";
  return null;
}

/** Today's doses for everyone at home, what is left first: tap one to mark it taken, tap again to undo. */
export function MedicationsTile({ items, interactive, onManage }: HouseholdTileProps<"medication">) {
  const now = useMinute();
  const { changeItem } = useHome();
  if (items.length === 0) return <SetupTile icon="pill" title="Add a medication" hint="Doses, times, and refills" tone="#ec4899" onClick={() => onManage()} interactive={interactive} />;

  const date = new Date(now ?? 0);
  const doses = now === null ? [] : items.flatMap(item => doseSlots(item.data, date, item.createdAt).map(slot => ({ item, slot })))
    .sort((a, b) => ORDER[a.slot.state] - ORDER[b.slot.state] || a.slot.at.getTime() - b.slot.at.getTime());
  const left = doses.filter(dose => dose.slot.state !== "taken");
  const missed = left.filter(dose => dose.slot.state === "missed").length;
  const next = left.find(dose => dose.slot.state !== "missed");
  const off = now === null ? [] : items.filter(item => !doses.some(dose => dose.item.id === item.id));
  const summary = missed ? `${missed} missed today` : next ? `Next: ${next.item.data.name} at ${clock(next.slot.at)}` : doses.length ? "All done for today" : "Nothing due today";

  const toggle = (item: WidgetItem<"medication">, slot: DoseSlot) => {
    const taken = slot.state !== "taken";
    void changeItem(item, data => {
      const record = { ...data.taken };
      if (taken) record[slot.key] = new Date().toISOString();
      else delete record[slot.key];
      return { ...data, taken: record, supply: data.supply === null ? null : Math.max(0, data.supply + (taken ? -1 : 1)) };
    }, () => setDoseTaken(item.id, slot.key, taken));
  };

  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} aria-label="Medications">
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Medications</h3>
          <p className={`${styles.meta} ${own.summary}`} data-warn={missed > 0 || undefined}>{summary}</p>
        </div>
        {interactive && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="Edit medications"><Settings2 size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
      </header>
      <ul className={own.list}>
        {doses.map(({ item, slot }) => {
          const supply = daysOfSupply(item.data);
          const low = supply !== null && supply <= REFILL_DAYS;
          const note = status(slot);
          return (
            <li key={`${item.id} ${slot.key}`}>
              <button type="button" className={own.dose} data-state={slot.state} style={{ "--med": item.data.color } as CSSProperties}
                disabled={!interactive} aria-pressed={slot.state === "taken"} onClick={() => toggle(item, slot)}
                aria-label={`${item.data.name} at ${clock(slot.at)}${note ? `, ${note.toLowerCase()}` : ""}`}>
                <span className={own.time}>{clock(slot.at)}</span>
                <span className={own.text}>
                  <span className={own.name}>{item.data.name}{item.data.dose && <span className={own.amount}> · {item.data.dose}</span>}</span>
                  {(item.data.person || note || low) && (
                    <span className={own.sub}>
                      {note && <span className={own.state}>{note}</span>}
                      {item.data.person && <span>{item.data.person}</span>}
                      {low && <span className={own.refill}>{supply === 0 ? "Out, refill now" : `${supply} ${supply === 1 ? "day" : "days"} left`}</span>}
                    </span>
                  )}
                </span>
                <span className={own.check} aria-hidden="true">{slot.state === "taken" && <Check size={14} strokeWidth={2.25} />}</span>
              </button>
            </li>
          );
        })}
        {off.length > 0 && <li className={own.off}>Not today: {off.map(item => item.data.name).join(", ")}</li>}
      </ul>
    </section>
  );
}
