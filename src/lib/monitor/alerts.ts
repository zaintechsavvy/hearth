import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_ALERTS, type AlertSettings } from "@/lib/activity-types";
import { db } from "@/lib/db";
import { preference } from "@/lib/db/schema";
import type { Device } from "@/lib/devices/types";
import { sendPush } from "@/lib/push";
import { itemsOf } from "@/lib/widgets/items";
import { doseSlots } from "@/lib/widgets/schedules";
import type { LoggedChange } from "./activity";
import { latestHomes } from "./monitor";

/** How far back a clock-driven alert looks, a little more than one tick, so each one is sent exactly once. */
const WINDOW_MS = 45_000;

const registry = globalThis as unknown as { hearthAlerts?: { openSince: Map<string, number>; sent: Map<string, number> } };
const state = registry.hearthAlerts ??= { openSince: new Map(), sent: new Map() };

async function settingsFor(userId: string): Promise<AlertSettings> {
  const row = await db.query.preference.findFirst({ where: eq(preference.userId, userId), columns: { alerts: true } });
  return { ...DEFAULT_ALERTS, ...row?.alerts };
}

/** Sends one alert once per key, so a flapping sensor or a repeated tick never notifies twice. */
async function once(userId: string, key: string, message: Parameters<typeof sendPush>[1]) {
  const full = `${userId}:${key}`;
  if (state.sent.has(full)) return;
  state.sent.set(full, Date.now());
  await sendPush(userId, message);
}

const where = (device: Device) => device.room ? ` in the ${device.room.toLowerCase()}` : "";

/** Alerts that follow straight from a change: the doorbell, leaks and smoke, and jammed locks. */
export async function alertOnChanges(userId: string, changes: LoggedChange[], at: Date) {
  const settings = await settingsFor(userId);
  for (const { device, what } of changes) {
    const stamp = at.getTime();
    if (settings.doorbell && device.kind === "event" && device.eventClass === "doorbell" && what === "rang") {
      await once(userId, `ring:${device.id}:${stamp}`, { title: "Someone is at the door", body: device.name, tag: `doorbell-${device.id}`, url: "/dashboard" });
    }
    if (settings.safety && device.kind === "binary_sensor" && (device.sensorClass === "leak" || device.sensorClass === "smoke") && device.active) {
      await once(userId, `safety:${device.id}:${stamp}`, { title: device.sensorClass === "leak" ? "Leak detected" : "Smoke detected", body: `${device.name}${where(device)}`, tag: `safety-${device.id}` });
    }
    if (settings.locks && device.kind === "lock" && device.state === "jammed") {
      await once(userId, `jam:${device.id}:${stamp}`, { title: `${device.name} is jammed`, body: "It could not finish locking. Check the door.", tag: `lock-${device.id}` });
    }
  }
}

const isOpenEntry = (device: Device) =>
  (device.kind === "cover" && ["garage", "door", "gate"].includes(device.coverClass) && device.state === "open")
  || (device.kind === "binary_sensor" && ["door", "garage", "opening"].includes(device.sensorClass) && device.active);

/** Alerts that need the clock: doors left open, timers that ran out, and doses that came due. */
export async function alertOnTick(now: Date) {
  const time = now.getTime();
  for (const [userId, home] of latestHomes()) {
    const settings = await settingsFor(userId);
    for (const device of home.devices) {
      const key = `${userId}:${device.id}`;
      if (!isOpenEntry(device)) {
        state.openSince.delete(key);
        continue;
      }
      const since = state.openSince.get(key) ?? time;
      state.openSince.set(key, since);
      if (settings.openMinutes > 0 && time - since >= settings.openMinutes * 60_000) {
        await once(userId, `open:${device.id}:${since}`, { title: `${device.name} is still open`, body: `It has been open for ${Math.round((time - since) / 60_000)} minutes.`, tag: `open-${device.id}`, url: "/dashboard" });
      }
    }
    if (settings.timers) {
      for (const timer of itemsOf(home.widgets, "timer")) {
        const ends = timer.data.endsAt ? Date.parse(timer.data.endsAt) : NaN;
        if (ends <= time && time - ends < WINDOW_MS * 2) await once(userId, `timer:${timer.id}:${timer.data.endsAt}`, { title: `${timer.data.label} is done`, body: "Your timer finished.", tag: `timer-${timer.id}` });
      }
    }
    if (settings.medications) {
      for (const medication of itemsOf(home.widgets, "medication")) {
        for (const slot of doseSlots(medication.data, now, medication.createdAt)) {
          const due = slot.at.getTime();
          if (slot.state !== "taken" && due <= time && time - due < WINDOW_MS * 2) {
            await once(userId, `dose:${medication.id}:${slot.key}`, { title: `Time for ${medication.data.name}`, body: [medication.data.dose, medication.data.person && `for ${medication.data.person}`].filter(Boolean).join(" "), tag: `dose-${medication.id}` });
          }
        }
      }
    }
  }
  for (const [key, at] of state.sent) if (time - at > 86_400_000) state.sent.delete(key);
}
