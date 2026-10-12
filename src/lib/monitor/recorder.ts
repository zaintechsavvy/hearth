import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { reading } from "@/lib/db/schema";
import type { Device } from "@/lib/devices/types";
import type { HomeChange } from "./monitor";

/** Two minutes between readings when the value moves, ten when it holds still. */
const MOVING_MS = 2 * 60_000;
const STILL_MS = 10 * 60_000;
const KEEP_MS = 30 * 86_400_000;
const PRUNE_MS = 6 * 3_600_000;

const registry = globalThis as unknown as { hearthRecorder?: { last: Map<string, { at: number; value: number }>; pruned: number } };
const state = registry.hearthRecorder ??= { last: new Map(), pruned: 0 };

/** The number worth charting for a device, if it has one. */
export function chartValue(device: Device): number | null {
  if (!device.available) return null;
  if (device.kind === "sensor") return device.value;
  if (device.kind === "thermostat") return device.current;
  return null;
}

export async function recordReadings({ userId, after, at }: HomeChange) {
  const rows: (typeof reading.$inferInsert)[] = [];
  const now = at.getTime();
  for (const device of after.values()) {
    const value = chartValue(device);
    if (value === null || !Number.isFinite(value)) continue;
    const key = `${userId}:${device.id}`;
    const last = state.last.get(key);
    if (last && now - last.at < (last.value === value ? STILL_MS : MOVING_MS)) continue;
    state.last.set(key, { at: now, value });
    rows.push({ userId, deviceId: device.id, at, value });
  }
  if (rows.length) await db.insert(reading).values(rows);
  if (now - state.pruned > PRUNE_MS) {
    state.pruned = now;
    await db.delete(reading).where(lt(reading.at, new Date(now - KEEP_MS)));
  }
}
