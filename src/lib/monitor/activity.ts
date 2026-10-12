import "server-only";
import { lt } from "drizzle-orm";
import { describeChange, type Change } from "@/lib/activity-diff";
import { db } from "@/lib/db";
import { activity } from "@/lib/db/schema";
import type { Device } from "@/lib/devices/types";
import { creditFor } from "./attribution";
import type { HomeChange } from "./monitor";

const KEEP_MS = 60 * 86_400_000;
const PRUNE_MS = 6 * 3_600_000;
const registry = globalThis as unknown as { hearthActivityPruned?: number };

export interface LoggedChange extends Change {
  device: Device;
  by: string | null;
}

type Listener = (userId: string, changes: LoggedChange[], at: Date) => unknown;
const listeners: Listener[] = [];

/** Runs after each batch of changes is logged, such as to send alerts or start automations. */
export function onLoggedChanges(listener: Listener) {
  if (!listeners.includes(listener)) listeners.push(listener);
}

/** Compares the home with its last look and writes what changed to the activity log. The first look only sets the baseline. */
export async function logActivity({ userId, before, after, at }: HomeChange) {
  if (!before) return;
  const changes: LoggedChange[] = [];
  for (const [id, device] of after) {
    const previous = before.get(id);
    if (!previous) continue;
    const change = describeChange(previous, device);
    if (change) changes.push({ ...change, device, by: creditFor(userId, id, at.getTime()) });
  }
  if (changes.length) {
    await db.insert(activity).values(changes.map(change => ({
      userId, at, deviceId: change.device.id, name: change.device.name, room: change.device.room, what: change.what, category: change.category, tone: change.tone, by: change.by,
    })));
    for (const listener of listeners) await listener(userId, changes, at);
  }
  const now = at.getTime();
  if (now - (registry.hearthActivityPruned ?? 0) > PRUNE_MS) {
    registry.hearthActivityPruned = now;
    await db.delete(activity).where(lt(activity.at, new Date(now - KEEP_MS)));
  }
}

/** For things the monitor notices itself, such as an alert it sent. */
export async function logEntry(userId: string, entry: { name: string; room?: string | null; what: string; category: Change["category"]; tone: Change["tone"]; deviceId?: string; by?: string }) {
  await db.insert(activity).values({ userId, at: new Date(), deviceId: entry.deviceId ?? null, name: entry.name, room: entry.room ?? null, what: entry.what, category: entry.category, tone: entry.tone, by: entry.by ?? null });
}
