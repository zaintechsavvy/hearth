import { boolean, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp as pgTimestamp } from "drizzle-orm/pg-core";
import { ASSISTANT_PROVIDER_IDS } from "@/lib/assistant/providers";
import type { DashboardPage, SavedTile, TileColor, TileIcon } from "@/lib/dashboard/layout";
import type { ItemKind } from "@/lib/widgets/items";
import type { SceneAction } from "@/lib/scenes/types";

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
  /** Rooms the person made in Hearth, in their chosen order. Rooms from integrations are added to these when shown. */
  rooms: jsonb("rooms").$type<string[]>().notNull().default([]),
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
