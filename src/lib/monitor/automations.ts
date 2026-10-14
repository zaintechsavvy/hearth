import "server-only";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { conditionHolds, fireTime, matches, pressed } from "@/lib/automations/logic";
import type { Automation, HomeLocation } from "@/lib/automations/types";
import { db } from "@/lib/db";
import { automation, preference } from "@/lib/db/schema";
import { isSensitive, type Device } from "@/lib/devices/types";
import { readableError, runCommand, runScene } from "@/lib/home";
import { sendPush } from "@/lib/push";
import { logEntry } from "./activity";
import { latestHomes, type HomeChange } from "./monitor";

/** A time or sun rule still runs if the server was busy when it came due, up to this late. */
const CATCH_UP_MS = 5 * 60_000;

type Row = typeof automation.$inferSelect;

const registry = globalThis as unknown as { hearthAutomations?: { waiting: Map<string, number>; done: Set<string> } };
const state = registry.hearthAutomations ??= { waiting: new Map(), done: new Set() };

const enabledFor = (userId: string) => db.select().from(automation)
  .where(and(eq(automation.userId, userId), eq(automation.enabled, true), or(isNull(automation.snoozedUntil), lte(automation.snoozedUntil, new Date()))));

async function locationFor(userId: string): Promise<HomeLocation | null> {
  const row = await db.query.preference.findFirst({ where: eq(preference.userId, userId), columns: { location: true } });
  return row?.location ?? null;
}

/** Runs a rule's steps in order if its conditions hold. A step that fails does not stop the rest; both are logged. */
async function run(row: Row, devices: Map<string, Device>, now: Date, location: HomeLocation | null) {
  if (!row.conditions.every(condition => conditionHolds(condition, devices, now, location))) return;
  const by = `the ${row.name} automation`;
  const problems: string[] = [];
  for (const action of row.actions) {
    try {
      if (action.type === "device") {
        const device = devices.get(action.deviceId);
        if (!device) throw new Error("that device is gone");
        if (isSensitive(device, action.command)) throw new Error(`automations never unlock or open ${device.name}`);
        await runCommand(row.userId, action.deviceId, action.command, by);
      } else if (action.type === "scene") {
        await runScene(row.userId, action.sceneId);
      } else {
        await sendPush(row.userId, { title: action.title, body: action.body, tag: `automation-${row.id}` });
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : readableError(error));
    }
  }
  await db.update(automation).set({ lastRun: now }).where(eq(automation.id, row.id));
  await logEntry(row.userId, { name: row.name, what: problems.length ? `ran, but ${problems.join("; ")}` : "ran", category: "automations", tone: problems.length ? "warning" : "info" });
}

/** Device rules: fire on the change into the matching state, or once it has held for the chosen minutes. */
export async function runDeviceAutomations({ userId, before, after, at }: HomeChange) {
  if (!before) return;
  const rows = (await enabledFor(userId)).filter(row => row.trigger.type === "device");
  if (rows.length === 0) return;
  const location = await locationFor(userId);
  for (const row of rows) {
    if (row.trigger.type !== "device") continue;
    const { deviceId, match, forMinutes } = row.trigger;
    if (match.is === "rang") {
      if (pressed(before.get(deviceId), after.get(deviceId))) await run(row, after, at, location);
      continue;
    }
    const now = matches(after.get(deviceId), match);
    const was = matches(before.get(deviceId), match);
    if (!now) {
      state.waiting.delete(row.id);
      state.done.delete(row.id);
      continue;
    }
    if (was) continue;
    if (forMinutes === 0) await run(row, after, at, location);
    else state.waiting.set(row.id, at.getTime());
  }
}

/** Clock rules, and device rules waiting out their minutes. */
export async function runTimedAutomations(now: Date) {
  const time = now.getTime();
  for (const [userId, home] of latestHomes()) {
    const rows = await enabledFor(userId);
    if (rows.length === 0) continue;
    const devices = new Map(home.devices.map(device => [device.id, device]));
    const location = await locationFor(userId);
    for (const row of rows) {
      if (row.trigger.type === "device") {
        const since = state.waiting.get(row.id);
        if (since === undefined || state.done.has(row.id) || time - since < row.trigger.forMinutes * 60_000) continue;
        if (!matches(devices.get(row.trigger.deviceId), row.trigger.match)) {
          state.waiting.delete(row.id);
          continue;
        }
        state.done.add(row.id);
        await run(row, devices, now, location);
        continue;
      }
      const due = fireTime(row.trigger, now, location);
      if (!due || time < due.getTime() || time - due.getTime() > CATCH_UP_MS) continue;
      if (due < row.createdAt || (row.lastRun && row.lastRun >= due) || (row.snoozedUntil && due < row.snoozedUntil)) continue;
      await run(row, devices, now, location);
    }
  }
}

export const toAutomation = (row: Row): Automation => ({ id: row.id, name: row.name, enabled: row.enabled, trigger: row.trigger, conditions: row.conditions, actions: row.actions, lastRun: row.lastRun?.toISOString() ?? null, snoozedUntil: row.snoozedUntil && row.snoozedUntil > new Date() ? row.snoozedUntil.toISOString() : null });

/** Runs one rule now, ignoring its trigger, for the Run now button. Its conditions still apply. */
export async function runAutomationNow(userId: string, id: string) {
  const row = await db.query.automation.findFirst({ where: and(eq(automation.id, id), eq(automation.userId, userId)) });
  if (!row) return false;
  const home = [...latestHomes()].find(([owner]) => owner === userId)?.[1];
  const devices = new Map((home?.devices ?? []).map(device => [device.id, device]));
  await run({ ...row, conditions: [] }, devices.size ? devices : await freshDevices(userId), new Date(), await locationFor(userId));
  return true;
}

async function freshDevices(userId: string) {
  const { loadHome } = await import("@/lib/home");
  return new Map((await loadHome(userId)).devices.map(device => [device.id, device]));
}
