"use client";

import { LineChart, type LineChartDatum } from "@/components/arc/line-chart/line-chart";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { SensorDevice } from "@/lib/devices/types";
import { useHistory } from "../use-history";
import styles from "./device-tiles.module.css";

const formatValue = (device: SensorDevice, value: number | null) => {
  if (value === null) return "—";
  const shown = Number.isInteger(value) ? value : value.toFixed(1);
  return device.sensorClass === "temperature" ? `${shown}°` : device.unit === "%" ? `${shown}%` : `${shown}${device.unit ? ` ${device.unit}` : ""}`;
};

/** A reading with its last day drawn under it, and the day's low and high. Tapping opens the full history. */
export function ChartTile({ device, config, onOpen }: { device: SensorDevice; config: TileConfig; onOpen?: () => void }) {
  const { data, isLoading } = useHistory(device.id, "24h");
  const wide = config.size === "4x2";
  const points: LineChartDatum[] = (data?.points ?? []).map((point, index, all) => ({
    key: String(point.t),
    label: new Date(point.t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    axisLabel: wide && index % Math.max(1, Math.floor(all.length / 5)) === 0 ? new Date(point.t).toLocaleTimeString(undefined, { hour: "numeric" }) : undefined,
    values: { value: point.v },
  }));
  const name = config.label?.trim() || device.name;
  return (
    <section className={`${glassClass("panel")} ${styles.card} ${styles.chart}`} data-size={config.size} aria-label={`${name}, ${formatValue(device, device.value)}`}>
      <button type="button" className={styles.chartHead} onClick={onOpen} disabled={!onOpen}>
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>{data?.min !== null && data?.max !== null && data ? `Low ${formatValue(device, data.min)} · High ${formatValue(device, data.max)}` : "Last 24 hours"}</span>
        </span>
        <span className={styles.big}>{formatValue(device, device.value)}</span>
      </button>
      <div className={styles.plot}>
        <LineChart label={`${name} over the last day`} data={points} series={[{ key: "value", label: name, area: true }]} height={wide ? 120 : 96}
          loading={isLoading && !data} emptyLabel="No readings yet" legend={false} curve="smooth" formatValue={value => formatValue(device, value)} formatTick={value => formatValue(device, value)} />
      </div>
    </section>
  );
}
