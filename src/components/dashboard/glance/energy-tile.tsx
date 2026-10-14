"use client";

import { Zap } from "lucide-react";
import { LineChart, type LineChartDatum } from "@/components/arc/line-chart/line-chart";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device, SensorDevice } from "@/lib/devices/types";
import { pickMeters, todayUse } from "@/lib/energy";
import { useHistory } from "../use-history";
import styles from "./glance.module.css";

const watts = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} kW` : `${Math.round(value)} W`;

/** Power right now, today's use and what it cost, and which devices are drawing the most. */
export function EnergyTile({ tile, devices }: { tile: TileConfig; devices: Device[] }) {
  const { main, total, parts } = pickMeters(devices);
  const { data: energy } = useHistory(total?.id ?? null, "24h");
  const { data: power } = useHistory(tile.size === "4x2" ? main?.id ?? null : null, "24h");
  if (!main && !total && parts.length === 0) {
    return (
      <section className={`${glassClass("panel")} ${styles.tile} ${styles.center}`} aria-label="Energy">
        <Zap size={24} strokeWidth={1.75} aria-hidden="true" />
        <p className={styles.title}>No energy readings yet</p>
        <p className={styles.meta}>Add a smart plug or energy monitor to Home Assistant and its power and energy sensors show up here.</p>
      </section>
    );
  }
  const now = main?.value ?? parts.reduce((sum, part) => sum + (part.value ?? 0), 0);
  const today = total ? todayUse(total, energy?.points ?? []) : null;
  const price = tile.options?.price;
  const top = parts.slice(0, tile.size === "4x2" ? 6 : 3);
  const biggest = Math.max(1, ...top.map(part => part.value ?? 0));
  const points: LineChartDatum[] = (power?.points ?? []).map(point => ({ key: String(point.t), label: new Date(point.t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), values: { value: point.v } }));
  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${styles.energy}`} data-size={tile.size} aria-label="Energy">
      <div className={styles.figures}>
        <div>
          <span className={styles.label}>Now</span>
          <span className={styles.big}>{watts(now)}</span>
        </div>
        {today !== null && (
          <div>
            <span className={styles.label}>Today</span>
            <span className={styles.big}>{today.toFixed(1)} kWh</span>
            {price ? <span className={styles.meta}>about ${(today * price).toFixed(2)}</span> : null}
          </div>
        )}
      </div>
      {tile.size === "4x2" && points.length > 1 && (
        <div className={styles.plot}><LineChart label="Power over the last day" data={points} series={[{ key: "value", label: "Power", area: true }]} height={80} legend={false} curve="smooth" formatValue={watts} formatTick={watts} /></div>
      )}
      {top.length > 0 && (
        <ul className={styles.bars} aria-label="Drawing the most">
          {top.map(part => (
            <li key={part.id} className={styles.bar}>
              <span className={styles.barName}>{shortName(part)}</span>
              <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${((part.value ?? 0) / biggest) * 100}%` }} /></span>
              <span className={styles.barValue}>{watts(part.value ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const shortName = (sensor: SensorDevice) => sensor.name.replace(/\s*(power|consumption|watts?)$/i, "") || sensor.name;
