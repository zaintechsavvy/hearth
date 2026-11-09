import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { describeChange } from "@/lib/activity-diff";
import { db } from "@/lib/db";
import { activity, homeWatch, integration } from "@/lib/db/schema";
import { loadHome } from "@/lib/home";
import { logSeenChanges, type LoggedChange } from "./activity";
import { alertOnChanges } from "./alerts";
import { recordHistory } from "@/lib/activity-feed";

/**
 * One look at every home with a connection, for hosts with no monitor running: what changed since the last look is
 * written to Activity, once however many screens or sweeps see it, and alerts go out. A scheduled job calls it.
 */
export async function sweepHomes(now = new Date()) {
  const homes = [...new Set((await db.select({ userId: integration.userId }).from(integration)).map(row => row.userId))];
  const results = await Promise.allSettled(homes.map(userId => sweepHome(userId, now)));
  return { homes: homes.length, failed: results.filter(result => result.status === "rejected").length };
}

async function sweepHome(userId: string, now: Date) {
  const [home, last] = await Promise.all([loadHome(userId), db.query.homeWatch.findFirst({ where: eq(homeWatch.userId, userId) })]);
  // Sweeps can be hours apart, so each one first writes down everything the integration recorded since the last.
  await recordHistory(userId, last?.checkedAt ?? new Date(now.getTime() - 86_400_000), now).catch(error => console.error(error));
  const devices = home.devices;
  if (last) {
    // A change already written down since the last look, such as one sent from Hearth or seen by an open screen, is not written again.
    const logged = new Set((await db.select({ deviceId: activity.deviceId, what: activity.what }).from(activity)
      .where(and(eq(activity.userId, userId), gte(activity.at, last.checkedAt)))).map(row => `${row.deviceId}|${row.what}`));
    const before = new Map(last.devices.map(device => [device.id, device]));
    for (const device of devices) {
      const previous = before.get(device.id);
      const change = previous ? describeChange(previous, device) : null;
      if (change && logged.has(`${device.id}|${change.what}`)) before.set(device.id, device);
    }
    await logSeenChanges(userId, before, devices, now);
    const changes: LoggedChange[] = devices.flatMap(device => {
      const previous = before.get(device.id);
      const change = previous ? describeChange(previous, device) : null;
      return change ? [{ ...change, device, by: null }] : [];
    });
    if (changes.length) await alertOnChanges(userId, changes, now);
  }
  // A home whose connection is down keeps its last look, so coming back does not log every device as changed.
  if (home.integrations.every(item => item.ok)) {
    await db.insert(homeWatch).values({ userId, devices, checkedAt: now }).onConflictDoUpdate({ target: homeWatch.userId, set: { devices, checkedAt: now } });
  }
}
