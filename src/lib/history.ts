import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { reading } from "@/lib/db/schema";
import { deviceProvider } from "@/lib/home";
import type { HistoryPoint } from "@/lib/integrations/types";
import { downsample } from "./downsample";

export const RANGES = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;
export type HistoryRange = keyof typeof RANGES;

export interface History {
  points: HistoryPoint[];
  min: number | null;
  max: number | null;
  average: number | null;
  /** Where the points came from: the integration's own history, or Hearth's recorder. */
  source: "integration" | "hearth";
}

export async function historyFor(userId: string, deviceId: string, range: HistoryRange): Promise<History | null> {
  const to = Date.now(), from = to - RANGES[range];
  const target = await deviceProvider(userId, deviceId);
  if (!target) return null;
  let points: HistoryPoint[] | null = null;
  let source: History["source"] = "integration";
  try {
    points = await target.provider.history?.(target.nativeId, new Date(from), new Date(to)) ?? null;
  } catch {
    points = null;
  }
  if (!points?.length) {
    source = "hearth";
    const rows = await db.select({ at: reading.at, value: reading.value }).from(reading)
      .where(and(eq(reading.userId, userId), eq(reading.deviceId, deviceId), gte(reading.at, new Date(from)))).orderBy(asc(reading.at));
    points = rows.map(row => ({ t: row.at.getTime(), v: row.value }));
  }
  const shown = downsample(points, from, to);
  const values = points.map(point => point.v);
  return {
    points: shown,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null,
    source,
  };
}
