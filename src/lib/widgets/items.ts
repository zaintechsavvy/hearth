import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00.");
const name = (label: string, max = 40) => z.string().trim().min(1, `Give the ${label} a name.`).max(max);

export const BIN_ICONS = ["trash", "recycle", "leaf", "package", "wine", "tree"] as const;
export const NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;
export const CARRIERS = ["amazon", "canada-post", "purolator", "ups", "fedex", "usps", "dhl", "other"] as const;
export const PACKAGE_STATES = ["coming", "delivered", "collected"] as const;

export const ITEM_SCHEMAS = {
  bin: z.object({
    name: name("bin"),
    color: hex,
    icon: z.enum(BIN_ICONS),
    /** 0 is Sunday. */
    weekday: z.number().int().min(0).max(6),
    /** Collected every this many weeks, counting from the week of `start`. */
    every: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    start: day,
  }),
  medication: z.object({
    name: name("medication"),
    dose: z.string().trim().max(40).default(""),
    person: z.string().trim().max(30).default(""),
    times: z.array(clock).min(1, "Add at least one time.").max(6),
    /** Days of the week it is taken, 0 is Sunday; empty means every day. */
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    color: hex,
    /** Doses left, when someone is counting. */
    supply: z.number().int().min(0).max(10_000).nullable().default(null),
    /** When each dose was taken, keyed by `YYYY-MM-DD HH:MM` of the scheduled slot. */
    taken: z.record(z.string(), z.string()).default({}),
  }),
  countdown: z.object({
    title: name("countdown", 50),
    date: day,
    emoji: z.string().max(8).default("🎉"),
    color: hex,
    /** Birthdays and anniversaries roll over to next year. */
    yearly: z.boolean().default(false),
  }),
  note: z.object({
    text: z.string().trim().min(1, "Write something first.").max(280),
    color: z.enum(NOTE_COLORS),
    author: z.string().trim().max(40).default(""),
  }),
  wifi: z.object({
    ssid: z.string().trim().min(1, "Enter the network name.").max(32),
    /** Sealed at rest, opened for the dashboard. */
    password: z.string().max(63).default(""),
    security: z.enum(["WPA", "WEP", "nopass"]),
    hidden: z.boolean().default(false),
  }),
  timer: z.object({
    label: name("timer", 30),
    durationMs: z.number().int().min(1000).max(24 * 3_600_000),
    /** When it rings, while running. */
    endsAt: z.string().nullable().default(null),
    /** What was left when paused, or the full duration before it starts. */
    remainingMs: z.number().int().min(0).max(24 * 3_600_000),
  }),
  package: z.object({
    name: name("package", 50),
    /** The shop it came from, such as Amazon. */
    from: z.string().trim().max(30).default(""),
    carrier: z.enum(CARRIERS).default("other"),
    tracking: z.string().trim().max(60).default(""),
    /** The day it is due, when known. */
    expected: day.nullable().default(null),
    status: z.enum(PACKAGE_STATES).default("coming"),
    deliveredAt: z.string().nullable().default(null),
    collectedAt: z.string().nullable().default(null),
    /** The latest scan from a tracker such as 17TRACK, when one follows this package. */
    track: z.object({ status: z.string(), info: z.string(), location: z.string(), at: z.string().nullable() }).nullable().default(null),
  }),
  /** A washer, dryer, or dishwasher, watched through the power its plug or monitor reports. */
  appliance: z.object({
    name: name("appliance", 30),
    type: z.enum(["washer", "dryer", "dishwasher", "other"]).default("washer"),
    /** The power sensor to watch. */
    sensorId: z.string().min(1, "Pick the power sensor.").max(300),
    /** Watts above which it counts as running. */
    threshold: z.number().min(1).max(500).default(5),
    /** When someone last emptied it, so a finished cycle stops asking. */
    emptiedAt: z.string().nullable().default(null),
  }),
  /** A track or playlist saved from a music player, to play again from any player. */
  favorite: z.object({
    title: z.string().trim().min(1).max(200),
    artist: z.string().trim().max(200).default(""),
    contentId: z.string().min(1).max(500),
    contentType: z.string().min(1).max(60),
  }),
  plant: z.object({
    name: name("plant"),
    emoji: z.string().max(8).default("🪴"),
    everyDays: z.number().int().min(1).max(60),
    lastWatered: z.string(),
    place: z.string().trim().max(30).default(""),
  }),
} as const;

export type ItemKind = keyof typeof ITEM_SCHEMAS;
export const ITEM_KINDS = Object.keys(ITEM_SCHEMAS) as ItemKind[];
export type ItemData<K extends ItemKind> = z.infer<(typeof ITEM_SCHEMAS)[K]>;

export interface WidgetItem<K extends ItemKind = ItemKind> {
  id: string;
  kind: K;
  data: ItemData<K>;
  position: number;
}

export const itemsOf = <K extends ItemKind>(items: WidgetItem[], kind: K) => items.filter((item): item is WidgetItem<K> => item.kind === kind).sort((a, b) => a.position - b.position);
