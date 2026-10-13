"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { LineChart, type LineChartDatum } from "@/components/arc/line-chart/line-chart";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { glassSheetClass } from "@/components/glass/glass";
import type { SensorDevice, ThermostatDevice } from "@/lib/devices/types";
import type { HistoryRange } from "@/lib/history";
import { useHistory } from "./use-history";
import styles from "./history-sheet.module.css";

export type ChartedDevice = SensorDevice | ThermostatDevice;

const unitOf = (device: ChartedDevice) => device.kind === "thermostat" ? `°${device.unit}` : device.sensorClass === "temperature" ? "°" : device.unit ?? "";
const now = (device: ChartedDevice) => device.kind === "thermostat" ? device.current : device.value;

/** A reading over the last day, week, or month, with its low, average, and high. */
export function HistorySheet({ device, onOpenChange }: { device: ChartedDevice | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(device)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={device?.name ?? "History"} description={device?.room && device.room !== device.name ? device.room : undefined}>
        {device && <Body key={device.id} device={device} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ device }: { device: ChartedDevice }) {
  const [range, setRange] = useState<HistoryRange>("24h");
  const { data, error, isLoading } = useHistory(device.id, range);
  const unit = unitOf(device);
  const format = (value: number | null) => value === null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
  const points: LineChartDatum[] = (data?.points ?? []).map((point, index, all) => {
    const date = new Date(point.t);
    const step = Math.max(1, Math.floor(all.length / 6));
    return {
      key: String(point.t),
      label: date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", month: range === "24h" ? undefined : "short", day: range === "24h" ? undefined : "numeric" }),
      axisLabel: index % step === 0 ? (range === "24h" ? date.toLocaleTimeString(undefined, { hour: "numeric" }) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })) : undefined,
      values: { value: point.v },
    };
  });
  return (
    <div className={styles.body}>
      <SegmentedControl label="Range" value={range} onValueChange={value => setRange(value as HistoryRange)} options={[{ value: "24h", label: "Day" }, { value: "7d", label: "Week" }, { value: "30d", label: "Month" }]} />
      <dl className={styles.stats}>
        <div><dt>Now</dt><dd>{format(now(device))}</dd></div>
        <div><dt>Low</dt><dd>{format(data?.min ?? null)}</dd></div>
        <div><dt>Average</dt><dd>{format(data?.average ?? null)}</dd></div>
        <div><dt>High</dt><dd>{format(data?.max ?? null)}</dd></div>
      </dl>
      <LineChart
        label={`${device.name} over the last ${range === "24h" ? "day" : range === "7d" ? "week" : "month"}`}
        data={points}
        series={[{ key: "value", label: device.name, area: true }]}
        unit={unit}
        height={220}
        loading={isLoading && !data}
        emptyLabel={error ? "History is unavailable right now." : "No readings yet. Hearth records them from now on."}
        formatValue={value => format(value)}
        formatTick={value => format(value)}
        legend={false}
        curve="smooth"
      />
      {data && <p className={styles.source}>{data.source === "integration" ? "From the integration's own history." : "Recorded by Hearth every few minutes."}</p>}
    </div>
  );
}
