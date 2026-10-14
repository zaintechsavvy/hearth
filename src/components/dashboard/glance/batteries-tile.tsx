import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device, SensorDevice } from "@/lib/devices/types";
import styles from "./glance.module.css";

const LOW = 25;

/** Batteries running low, lowest first, and devices that dropped off, so nothing quietly stops working. */
export function BatteriesTile({ tile, devices }: { tile: TileConfig; devices: Device[] }) {
  const batteries = devices.filter((device): device is SensorDevice => device.kind === "sensor" && device.sensorClass === "battery" && device.value !== null).sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const low = batteries.filter(device => (device.value ?? 100) < LOW);
  const offline = devices.filter(device => !device.available && !device.auxiliary && device.kind !== "person");
  const shown = [...low.map(device => ({ id: device.id, name: device.name.replace(/\s*battery$/i, ""), detail: `${Math.round(device.value ?? 0)}%`, level: device.value ?? 0 })), ...offline.map(device => ({ id: device.id, name: device.name, detail: "Offline", level: null }))];
  const healthy = shown.length === 0;
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Batteries">
      <header className={styles.header}>
        <span className={styles.title}>Batteries</span>
        <span className={styles.meta}>{healthy ? `All ${batteries.length} batteries are fine` : [low.length ? `${low.length} low` : null, offline.length ? `${offline.length} offline` : null].filter(Boolean).join(" · ")}</span>
      </header>
      <ul className={styles.rows}>
        {(healthy ? batteries.slice(0, 4).map(device => ({ id: device.id, name: device.name.replace(/\s*battery$/i, ""), detail: `${Math.round(device.value ?? 0)}%`, level: device.value })) : shown).map(item => (
          <li key={item.id} className={styles.row} data-warn={item.level === null || (item.level ?? 100) < LOW || undefined}>
            <span className={styles.cell} aria-hidden="true">{item.level !== null && <span style={{ height: `${Math.max(8, item.level)}%` }} />}</span>
            <span className={styles.rowName}>{item.name}</span>
            <span className={styles.meta}>{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
