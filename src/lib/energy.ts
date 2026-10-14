import type { Device, SensorDevice } from "@/lib/devices/types";
import type { HistoryPoint } from "@/lib/integrations/types";

const WHOLE_HOME = /\b(home|house|total|whole|grid|main|mains|consumption)\b/i;

/**
 * The meters an energy tile reads: the whole home's power and its running energy total, named like "Home power",
 * and every other power sensor, biggest draw first.
 */
export function pickMeters(devices: Device[]) {
  const sensors = devices.filter((device): device is SensorDevice => device.kind === "sensor" && device.available && device.value !== null);
  const power = sensors.filter(sensor => sensor.sensorClass === "power");
  const energy = sensors.filter(sensor => sensor.sensorClass === "energy");
  const main = power.find(sensor => WHOLE_HOME.test(sensor.name)) ?? null;
  const total = energy.find(sensor => WHOLE_HOME.test(sensor.name)) ?? energy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;
  const parts = power.filter(sensor => sensor !== main).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return { main, total, parts };
}

/** kWh used since midnight: the running total now, less where it stood when the day began. */
export function todayUse(total: SensorDevice, points: HistoryPoint[], now = new Date()) {
  if (total.value === null) return null;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const start = points.find(point => point.t >= midnight.getTime());
  if (!start) return null;
  const used = total.unit === "Wh" ? (total.value - start.v) / 1000 : total.value - start.v;
  return used >= 0 ? used : null;
}

export interface Run {
  start: number;
  /** Null while it is still running. */
  end: number | null;
}

/** The latest stretch above `threshold` watts that lasted at least five minutes. */
export function lastRun(points: HistoryPoint[], threshold: number, minimumMs = 5 * 60_000): Run | null {
  let index = points.length - 1;
  while (index >= 0) {
    while (index >= 0 && points[index].v <= threshold) index--;
    if (index < 0) return null;
    const endIndex = index;
    while (index > 0 && points[index - 1].v > threshold) index--;
    const start = points[index].t;
    const end = endIndex === points.length - 1 ? null : points[endIndex + 1].t;
    if ((end ?? points[endIndex].t) - start >= minimumMs || end === null) return { start, end };
    index--;
  }
  return null;
}
