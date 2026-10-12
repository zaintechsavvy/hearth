import type { ItemData } from "./items";

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for a local date. */
export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const atNoon = (key: string) => new Date(`${key}T12:00:00`);
export const daysBetween = (from: Date, to: Date) => Math.round((atNoon(localDay(to)).getTime() - atNoon(localDay(from)).getTime()) / DAY_MS);

/** The next collection on or after today: the bin's weekday, in a week that lines up with its start for fortnightly and four-weekly bins. */
export function nextPickup(bin: ItemData<"bin">, now: Date) {
  const start = atNoon(bin.start);
  const anchor = new Date(start.getTime() + ((bin.weekday - start.getDay() + 7) % 7) * DAY_MS);
  const today = atNoon(localDay(now));
  let candidate = new Date(today.getTime() + ((bin.weekday - today.getDay() + 7) % 7) * DAY_MS);
  for (let guard = 0; guard < 8; guard++) {
    const weeks = Math.round((candidate.getTime() - anchor.getTime()) / (7 * DAY_MS));
    if (((weeks % bin.every) + bin.every) % bin.every === 0) break;
    candidate = new Date(candidate.getTime() + 7 * DAY_MS);
  }
  return localDay(candidate);
}

export interface PickupGroup<T> {
  date: string;
  days: number;
  bins: T[];
}

/** Bins grouped by their next collection, soonest first, so bins that go out together share one card. */
export function groupPickups<T extends { data: ItemData<"bin"> }>(bins: T[], now: Date): PickupGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const bin of bins) {
    const date = nextPickup(bin.data, now);
    groups.set(date, [...(groups.get(date) ?? []), bin]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, days: daysBetween(now, atNoon(date)), bins: items }));
}

export const PUT_OUT_FROM_HOUR = 17;

/** What to say about a collection: "Put out tonight" from five the evening before. */
export function pickupWords(days: number, now: Date) {
  if (days === 0) return "Today";
  if (days === 1) return now.getHours() >= PUT_OUT_FROM_HOUR ? "Put out tonight" : "Tomorrow";
  return `In ${days} days`;
}

export type DoseState = "taken" | "due" | "upcoming" | "missed";

export interface DoseSlot {
  key: string;
  time: string;
  at: Date;
  state: DoseState;
  takenAt: string | null;
}

/** How long after its time a dose still counts as due rather than missed. */
export const DOSE_GRACE_MS = 60 * 60_000;
/** How early a dose can be marked due. */
export const DOSE_EARLY_MS = 30 * 60_000;

export function doseSlots(medication: ItemData<"medication">, now: Date): DoseSlot[] {
  if (medication.weekdays.length && !medication.weekdays.includes(now.getDay())) return [];
  const today = localDay(now);
  return [...medication.times].sort().map(time => {
    const key = `${today} ${time}`;
    const at = new Date(`${today}T${time}:00`);
    const takenAt = medication.taken[key] ?? null;
    const state: DoseState = takenAt ? "taken"
      : now.getTime() > at.getTime() + DOSE_GRACE_MS ? "missed"
        : now.getTime() >= at.getTime() - DOSE_EARLY_MS ? "due" : "upcoming";
    return { key, time, at, state, takenAt };
  });
}

/** Doses a day, for working out how long a supply lasts. */
export const dosesPerWeek = (medication: ItemData<"medication">) => medication.times.length * (medication.weekdays.length || 7);
export const daysOfSupply = (medication: ItemData<"medication">) => medication.supply === null ? null : Math.floor(medication.supply / (dosesPerWeek(medication) / 7));

/** Days to the date, rolling yearly ones over once they pass. */
export function countdownDays(countdown: ItemData<"countdown">, now: Date) {
  const target = atNoon(countdown.date);
  if (countdown.yearly) {
    target.setFullYear(now.getFullYear());
    if (daysBetween(now, target) < 0) target.setFullYear(now.getFullYear() + 1);
  }
  return { days: daysBetween(now, target), date: target };
}

/** 1 just watered, 0 due today, below zero overdue. */
export function plantThirst(plant: ItemData<"plant">, now: Date) {
  const since = daysBetween(new Date(plant.lastWatered), now);
  return { since, left: plant.everyDays - since, level: Math.max(-0.5, Math.min(1, 1 - since / plant.everyDays)) };
}

export function timerRemaining(timer: ItemData<"timer">, now: number) {
  return timer.endsAt ? Math.max(0, Date.parse(timer.endsAt) - now) : timer.remainingMs;
}

export function formatDuration(ms: number) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/** The text a phone camera turns into "join this network". */
export function wifiQrText(wifi: ItemData<"wifi">) {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${wifi.security};S:${escape(wifi.ssid)};${wifi.security === "nopass" ? "" : `P:${escape(wifi.password)};`}${wifi.hidden ? "H:true;" : ""};`;
}
