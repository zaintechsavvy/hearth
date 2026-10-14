"use client";

import { Droplets, Settings2 } from "lucide-react";
import type { CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { waterPlant } from "@/lib/widget-actions";
import { plantThirst } from "@/lib/widgets/schedules";
import { useHome } from "../use-home";
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./household.module.css";
import own from "./plants-tile.module.css";

function thirstWords(left: number) {
  if (left > 1) return `Water in ${left} days`;
  if (left === 1) return "Water tomorrow";
  if (left === 0) return "Water today";
  return `Thirsty, ${-left} ${left === -1 ? "day" : "days"} late`;
}

/** Thirstiest first, as many to a row as the tile is wide, each with a water meter that empties between waterings and a tap to say it was watered. */
export function PlantsTile({ items, interactive, onManage }: HouseholdTileProps<"plant">) {
  const now = useMinute();
  const { changeItem } = useHome();
  if (items.length === 0) return <SetupTile icon="sprout" title="Add your plants" hint="How often each needs water" tone="#22c55e" onClick={() => onManage()} interactive={interactive} />;
  const date = new Date(now ?? 0);
  const plants = items
    .map(item => ({ item, thirst: plantThirst(item.data, date) }))
    .sort((a, b) => a.thirst.left - b.thirst.left);
  const thirsty = plants.filter(entry => entry.thirst.left <= 0).length;
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} aria-label="Plants">
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Plants</h3>
          <p className={styles.meta}>{thirsty ? `${thirsty} need water` : "Everyone is happy"}</p>
        </div>
        {interactive && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="Edit plants"><Settings2 size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
      </header>
      <ul className={own.grid} style={{ "--count": plants.length } as CSSProperties}>
        {plants.map(({ item, thirst }) => (
          <li key={item.id} className={own.cell}>
            <div className={own.plant} data-thirsty={thirst.left <= 0 || undefined} style={{ "--level": Math.max(0, thirst.level) } as CSSProperties}>
              <span className={own.emoji} aria-hidden="true">{item.data.emoji}</span>
              <span className={own.text}>
                <span className={own.name}>{item.data.name}{item.data.place && <span className={own.place}> · {item.data.place}</span>}</span>
                <span className={own.meter} aria-hidden="true"><span /></span>
                <span className={own.words}>{now === null ? "" : thirstWords(thirst.left)}</span>
              </span>
              <button type="button" className={own.water} disabled={!interactive} aria-label={`Watered ${item.data.name}`} title="Watered"
                onClick={() => void changeItem(item, data => ({ ...data, lastWatered: new Date().toISOString() }), () => waterPlant(item.id))}>
                <Droplets size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
