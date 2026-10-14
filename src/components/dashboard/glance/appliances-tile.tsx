"use client";

import { Check, Settings2, WashingMachine } from "lucide-react";
import { useState } from "react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device } from "@/lib/devices/types";
import { lastRun } from "@/lib/energy";
import { saveWidgetItem } from "@/lib/widget-actions";
import type { WidgetItem } from "@/lib/widgets/items";
import { SetupTile } from "../household/choices";
import { useHistory } from "../use-history";
import styles from "./glance.module.css";

/** How long a finished cycle keeps asking to be emptied. */
const DONE_FOR_MS = 12 * 3_600_000;
const NOUN = { washer: "washing", dryer: "drying", dishwasher: "dishes", other: "cycle" } as const;

const minutes = (ms: number) => {
  const total = Math.max(1, Math.round(ms / 60_000));
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60 ? `${total % 60} min` : ""}`.trim();
};

/** Washers, dryers, and dishwashers: running and for how long, and "done, empty it" until someone does. Works from any power reading. */
export function AppliancesTile({ tile, items, devices, now, interactive, onManage }: { tile: TileConfig; items: WidgetItem<"appliance">[]; devices: Device[]; now: number | null; interactive: boolean; onManage: () => void }) {
  if (items.length === 0) return <SetupTile icon="washing-machine" title="Watch the laundry" hint="Pick a washer or dryer's power plug" tone="#3b82f6" onClick={onManage} interactive={interactive} />;
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Laundry and dishes">
      {tile.size !== "2x1" && (
        <header className={styles.header}>
          <span className={styles.title}>Laundry and dishes</span>
          {interactive && <button type="button" className={styles.manage} onClick={onManage} aria-label="Edit appliances"><Settings2 size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
        </header>
      )}
      <ul className={styles.rows} data-wide={tile.size === "4x1" || undefined}>
        {items.map(item => <Appliance key={item.id} item={item} devices={devices} now={now} interactive={interactive} />)}
      </ul>
    </section>
  );
}

function Appliance({ item, devices, now, interactive }: { item: WidgetItem<"appliance">; devices: Device[]; now: number | null; interactive: boolean }) {
  const sensor = devices.find(device => device.id === item.data.sensorId);
  const { data } = useHistory(item.data.sensorId, "24h");
  const [emptied, setEmptied] = useState<string | null>(null);
  const reading = sensor?.kind === "sensor" ? sensor.value : null;
  const run = lastRun([...(data?.points ?? []), ...(reading !== null && now ? [{ t: now, v: reading }] : [])], item.data.threshold);
  const running = reading !== null && reading > item.data.threshold;
  const emptiedAt = Date.parse(emptied ?? item.data.emptiedAt ?? "") || 0;
  const done = !running && run?.end && now && run.end > emptiedAt && now - run.end < DONE_FOR_MS ? run.end : null;
  const words = !sensor ? "Its power sensor is gone"
    : running ? `Running${run && now ? ` · ${minutes(now - run.start)}` : ""}`
    : done && now ? `Done ${minutes(now - done)} ago` : "Idle";
  return (
    <li className={styles.row} data-done={done ? "" : undefined} data-running={running || undefined}>
      <span className={styles.applianceIcon} aria-hidden="true"><WashingMachine size={18} strokeWidth={1.75} /></span>
      <span className={styles.text}>
        <span className={styles.rowName}>{item.data.name}</span>
        <span className={styles.meta}>{words}</span>
      </span>
      {done && (
        <button type="button" className={styles.emptied} disabled={!interactive} onClick={() => {
          const at = new Date().toISOString();
          setEmptied(at);
          void saveWidgetItem("appliance", { ...item.data, emptiedAt: at }, item.id);
        }} aria-label={`Emptied the ${NOUN[item.data.type]}`}><Check size={14} strokeWidth={1.75} aria-hidden="true" />Emptied</button>
      )}
    </li>
  );
}
