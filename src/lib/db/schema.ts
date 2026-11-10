import type { Device, SwitchableKind, TodoItem } from "@/lib/devices/types";
import { boolean, customType, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp as pgTimestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ASSISTANT_PROVIDER_IDS } from "@/lib/assistant/providers";
import type { DashboardPage, SavedTile, TileColor, TileIcon } from "@/lib/dashboard/layout";
import type { ItemKind } from "@/lib/widgets/items";
import { DEFAULT_ALERTS, type ActivityCategory, type AlertSettings } from "@/lib/activity-types";
import { DEFAULT_SECURITY, type SecuritySettings } from "@/lib/security-types";
import { DEFAULT_BEDTIME, type BedtimeSettings } from "@/lib/bedtime";
import type { Action, Condition, HomeLocation, Trigger } from "@/lib/automations/types";
import type { SceneAction } from "@/lib/scenes/types";
import type { SyncedBackground } from "@/lib/theme";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => timestamp("created_at").notNull().$defaultFn(() => new Date());
const updatedAt = () => timestamp("updated_at").notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date());

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const integration = pgTable("integration", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["home-assistant", "matter", "demo"] }).notNull(),
  name: text("name").notNull(),
  /** Sealed with `lib/crypto`: holds URLs and access tokens. */
  config: text("config").notNull(),
  createdAt: createdAt(),
}, t => [index("integration_user_idx").on(t.userId)]);

/** The demo home's simulated devices, shared by every server instance so a change sticks when the next request lands elsewhere. */
export const demoState = pgTable("demo_state", {
  integrationId: text("integration_id").primaryKey().references(() => integration.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  devices: jsonb("devices").$type<Device[]>().notNull(),
  lists: jsonb("lists").$type<Record<string, TodoItem[]>>().notNull(),
  /** Covers still travelling: when each started and which way, so any instance can finish the move. */
  moving: jsonb("moving").$type<Record<string, { at: number; open: boolean }>>().notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const camera = pgTable("camera", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Sealed `CameraSource`: the RTSP URL and its credentials never leave the server. */
  source: text("source").notNull(),
  createdAt: createdAt(),
}, t => [index("camera_user_idx").on(t.userId)]);

export const preference = pgTable("preference", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  streamRelayUrl: text("stream_relay_url"),
  /** Dashboard tiles in display order, read through `resolveLayout`. */
  layout: jsonb("layout").$type<SavedTile[]>().notNull().$defaultFn(() => []),
  /**
   * Dashboard pages in order, each with its own tiles. Empty until a second page is made; until then `layout` is the
   * only page, called Home, and it stays in step with the first page afterwards.
   */
  pages: jsonb("pages").$type<DashboardPage[]>().notNull().default([]),
  /** Where the home is, for sunrise and sunset automations. */
  location: jsonb("location").$type<HomeLocation | null>(),
  /** Which alerts reach this person's phones and tablets. */
  alerts: jsonb("alerts").$type<AlertSettings>().notNull().default(DEFAULT_ALERTS),
  /** Rooms the person made in Hearth, in their chosen order. Rooms from integrations are added to these when shown. */
  rooms: jsonb("rooms").$type<string[]>().notNull().default([]),
  /** How opening the home is confirmed, with the hashed PIN when there is one. */
  security: jsonb("security").$type<SecuritySettings>().notNull().default(DEFAULT_SECURITY),
  /** What the good night check does. */
  bedtime: jsonb("bedtime").$type<BedtimeSettings>().notNull().default(DEFAULT_BEDTIME),
  /** The Transitland key for the departures tile, sealed with `lib/crypto`. */
  transit: jsonb("transit").$type<{ key: string; sample?: boolean } | null>(),
  /** An Immich album for the wall tablet's photo frame; the key is sealed with `lib/crypto`. */
  photos: jsonb("photos").$type<{ url: string; key: string; album: string } | null>(),
  /** The background this person picked, kept per person so every device they sign in on shows it. */
  background: jsonb("background").$type<SyncedBackground | null>(),
  /** The owner's background reaches everyone in the home, unless they have picked one of their own since. */
  shareBackground: boolean("share_background").notNull().default(false),
  updatedAt: updatedAt(),
});

export const assistant = pgTable("assistant", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ASSISTANT_PROVIDER_IDS }).notNull(),
  model: text("model").notNull(),
  /** Sealed with `lib/crypto`. */
  apiKey: text("api_key").notNull(),
  /** Only for `custom`: any server that speaks Chat Completions, such as Ollama, LM Studio, or OpenRouter. */
  baseUrl: text("base_url"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
}, t => [index("assistant_user_idx").on(t.userId)]);

export const scene = pgTable("scene", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").$type<TileIcon>(),
  /** Run in order when the scene is activated. Device ids may point at devices that no longer exist; those are skipped. */
  actions: jsonb("actions").$type<SceneAction[]>().notNull(),
  createdAt: createdAt(),
}, t => [index("scene_user_idx").on(t.userId)]);

export const calendar = pgTable("calendar", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").$type<TileColor>().notNull(),
  /** Sealed: a secret iCal address reads the whole calendar without signing in, so it is a credential. */
  url: text("url").notNull(),
  createdAt: createdAt(),
}, t => [index("calendar_user_idx").on(t.userId)]);

export const reminder = pgTable("reminder", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: timestamp("due_at"),
  doneAt: timestamp("done_at"),
  createdAt: createdAt(),
}, t => [index("reminder_user_idx").on(t.userId)]);

/** Names and rooms set in Hearth, which win over what the integration reports and leave the integration unchanged. */
export const deviceOverride = pgTable("device_override", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  /** A device id, or `camera:<id>` for an RTSP camera. */
  deviceId: text("device_id").notNull(),
  name: text("name"),
  /** Null keeps the integration's room; an empty string means no room. */
  room: text("room"),
  /** What an on/off device shows as in Hearth, such as a light switch Home Assistant files as a fan; null keeps the integration's kind. */
  kind: text("kind").$type<SwitchableKind>(),
  /** A doorbell's camera, as a device id; null finds the camera that matches it. */
  camera: text("camera"),
  /** Left out of Activity, such as an occupancy sensor that fires every minute someone sits in a room. */
  quiet: boolean("quiet").notNull().default(false),
  updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.userId, t.deviceId] })]);

/** Photos uploaded as backdrops, already resized in the browser. Kept per account so a wall tablet sees them too. */
export const background = pgTable("background", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  mime: text("mime", { enum: ["image/webp", "image/jpeg", "image/png"] }).notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: createdAt(),
}, t => [index("background_user_idx").on(t.userId)]);

/** Everything the household widgets keep: bins, medications, countdowns, notes, Wi-Fi, timers, and plants. */
export const widgetItem = pgTable("widget_item", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").$type<ItemKind>().notNull(),
  /** Checked against `ITEM_SCHEMAS` on every write. A Wi-Fi password inside is sealed. */
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index("widget_item_user_idx").on(t.userId)]);

/** Readings Hearth recorded itself, for sensors whose integration keeps no history. Kept for 30 days. */
export const reading = pgTable("reading", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  at: timestamp("at").notNull(),
  value: doublePrecision("value").notNull(),
}, t => [index("reading_device_idx").on(t.userId, t.deviceId, t.at)]);

/** What happened at home and who did it: lights, locks, doors, sensors, the doorbell, and alerts sent. Kept 60 days. */
export const activity = pgTable("activity", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  at: timestamp("at").notNull(),
  deviceId: text("device_id"),
  /** The device's name and room when it happened, so the log reads the same after a rename. */
  name: text("name").notNull(),
  room: text("room"),
  /** What happened, as the end of a sentence: "unlocked", "opened", "rang". */
  what: text("what").notNull(),
  category: text("category").$type<ActivityCategory>().notNull(),
  tone: text("tone", { enum: ["info", "warning", "alert"] }).notNull(),
  /** Who or what did it, when Hearth knows: a person, the assistant, a scene, or an automation. */
  by: text("by"),
  /** One change seen by several screens at once is kept once: the device, what happened, and when the integration says it did. */
  dedupe: text("dedupe"),
}, t => [index("activity_user_at_idx").on(t.userId, t.at), uniqueIndex("activity_dedupe_idx").on(t.userId, t.dedupe)]);

/** A picture from the doorbell's camera when it rang, shown beside the ring in Activity. Kept 30 days. */
export const ringPicture = pgTable("ring_picture", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  /** The doorbell's device id. */
  deviceId: text("device_id").notNull(),
  at: timestamp("at").notNull(),
  cameraName: text("camera_name").notNull(),
  contentType: text("content_type").notNull(),
  /** The JPEG, base64. */
  image: text("image").notNull(),
}, t => [uniqueIndex("ring_picture_ring_idx").on(t.userId, t.deviceId, t.at)]);

/** A browser or phone that asked for alerts. Removed when the push service says it is gone. */
export const pushSubscription = pgTable("push_subscription", {
  endpoint: text("endpoint").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  label: text("label").notNull(),
  createdAt: createdAt(),
}, t => [index("push_subscription_user_idx").on(t.userId)]);

/** Values the server makes once and keeps, such as its Web Push keys. Sealed. */
export const serverSecret = pgTable("server_secret", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: createdAt(),
});

/** When, if, then rules the home monitor runs. Unlocking and opening are refused when saved and when run. */
export const automation = pgTable("automation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  trigger: jsonb("trigger").$type<Trigger>().notNull(),
  conditions: jsonb("conditions").$type<Condition[]>().notNull().default([]),
  actions: jsonb("actions").$type<Action[]>().notNull(),
  lastRun: timestamp("last_run"),
  /** Skipped by the monitor until then; it resumes by itself once the time passes. */
  snoozedUntil: timestamp("snoozed_until"),
  createdAt: createdAt(),
}, t => [index("automation_user_idx").on(t.userId)]);

/** Someone who shares another person's home. One home each; leaving restores their own. */
export const membership = pgTable("membership", {
  memberId: text("member_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["member", "guest"] }).notNull(),
  /** For guests, the dashboard pages they can see. */
  pages: jsonb("pages").$type<string[]>(),
  createdAt: createdAt(),
}, t => [index("membership_owner_idx").on(t.ownerId)]);

/** A link the owner shares to bring someone into the home. */
export const invite = pgTable("invite", {
  code: text("code").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["member", "guest"] }).notNull(),
  pages: jsonb("pages").$type<string[]>(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
}, t => [index("invite_owner_idx").on(t.ownerId)]);

/** Each home's devices as the scheduled sweep last saw them, so a hosted Hearth notices changes with no screen open. */
export const homeWatch = pgTable("home_watch", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  devices: jsonb("devices").$type<Device[]>().notNull(),
  checkedAt: timestamp("checked_at").notNull(),
});
