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

/** Today's doses. Ones already past their grace when the medication was added (`since`) are left out rather than missed. */
export function doseSlots(medication: ItemData<"medication">, now: Date, since?: string): DoseSlot[] {
  if (medication.weekdays.length && !medication.weekdays.includes(now.getDay())) return [];
  const today = localDay(now);
  const added = since ? Date.parse(since) : -Infinity;
  return [...medication.times].sort().filter(time => new Date(`${today}T${time}:00`).getTime() + DOSE_GRACE_MS >= added || medication.taken[`${today} ${time}`]).map(time => {
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

export type TimerControl = { action: "start" | "pause" | "reset" | "restart" } | { action: "add"; ms: number };

/** A timer after one press, worked out the same way on the server and, to show it at once, in the browser. */
export function applyTimerControl(timer: ItemData<"timer">, control: TimerControl, now = Date.now()): ItemData<"timer"> {
  const left = timerRemaining(timer, now);
  switch (control.action) {
    case "start":
      return { ...timer, endsAt: new Date(now + (left > 0 ? left : timer.durationMs)).toISOString() };
    case "pause":
      return { ...timer, endsAt: null, remainingMs: left };
    case "reset":
      return { ...timer, endsAt: null, remainingMs: timer.durationMs };
    case "restart":
      return { ...timer, endsAt: new Date(now + timer.durationMs).toISOString(), remainingMs: timer.durationMs };
    case "add": {
      const remaining = Math.max(1000, left + control.ms);
      return timer.endsAt ? { ...timer, endsAt: new Date(now + remaining).toISOString() } : { ...timer, remainingMs: remaining };
    }
  }
}

/** A running timer of the usual kind, named by its length. */
export function quickTimer(minutes: number, now = Date.now()): ItemData<"timer"> {
  const durationMs = minutes * 60_000;
  return { label: `${minutes} min`, durationMs, remainingMs: durationMs, endsAt: new Date(now + durationMs).toISOString() };
}

/** One colour each when several timers run side by side, given in the order they were set so a timer keeps its colour while it runs. */
const TIMER_COLORS = ["#f59e0b", "#3b82f6", "#ec4899", "#10b981", "#8b5cf6", "#ef4444"];
export function timerColors(timers: { id: string; createdAt?: string }[]) {
  const order = [...timers].sort((a, b) => (a.createdAt ?? "~").localeCompare(b.createdAt ?? "~") || a.id.localeCompare(b.id));
  return new Map(order.map((timer, index) => [timer.id, TIMER_COLORS[index % TIMER_COLORS.length]]));
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fifty: 50, sixty: 60, ninety: 90, half: 0.5 };
const UNIT_MS: Record<string, number> = { second: 1000, sec: 1000, minute: 60_000, min: 60_000, hour: 3_600_000, hr: 3_600_000 };
const AMOUNT = "(\\d+(?:\\.\\d+)?|forty five|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|half)";
const UNIT = "(second|sec|minute|min|hour|hr)s?";
const TIMER_PATTERN = new RegExp(`(?:set|start|make|create|put on)?\\s*(?:a|an)?\\s*(?:timer\\s+for\\s+)?${AMOUNT}\\s*(?:-|\\s)?\\s*(?:an?\\s+)?${UNIT}(?:\\s+and\\s+(?:a\\s+)?half)?(?:\\s+(?:([a-z][a-z ]{0,24}?)\\s+)?timer)?(?:\\s+(?:for|called|named)\\s+(?:the\\s+)?([a-z][a-z ]{0,24}))?`);

/** A spoken or typed "set a 10 minute timer for the pasta", as a timer to start, or null when the words ask for something else. */
export function parseTimerRequest(text: string): ItemData<"timer"> & { endsAt: string } | null {
  const words = text.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!/\btimer\b/.test(words)) return null;
  const match = TIMER_PATTERN.exec(words);
  if (!match) return null;
  const [whole, amount, unit, before, after] = match;
  const count = NUMBER_WORDS[amount] ?? Number(amount);
  const durationMs = Math.round((count + (/and (a )?half/.test(whole) ? 0.5 : 0)) * UNIT_MS[unit]);
  if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 24 * 3_600_000) return null;
  const name = (after ?? before)?.trim();
  const label = name && name !== "a" ? name.replace(/^\w/, char => char.toUpperCase()) : formatSpoken(durationMs);
  return { label: label.slice(0, 30), durationMs, remainingMs: durationMs, endsAt: new Date(Date.now() + durationMs).toISOString() };
}

/** "10 min", "1 hr 30 min", "45 sec". */
export function formatSpoken(ms: number) {
  const hours = Math.floor(ms / 3_600_000), minutes = Math.floor((ms % 3_600_000) / 60_000), seconds = Math.round((ms % 60_000) / 1000);
  return [hours && `${hours} hr`, minutes && `${minutes} min`, !hours && !minutes && `${seconds} sec`].filter(Boolean).join(" ");
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
