import { boolean, index, jsonb, pgTable, text, timestamp as pgTimestamp } from "drizzle-orm/pg-core";
import { ASSISTANT_PROVIDER_IDS } from "@/lib/assistant/providers";
import type { TileConfig, TileIcon } from "@/lib/dashboard/layout";
import type { SceneAction } from "@/lib/scenes/types";

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
  /** When the person last chose which of its devices to show. After that, newly found devices start hidden. */
  curatedAt: timestamp("curated_at"),
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
  /** Dashboard tiles in display order. Reconciled with live devices by `resolveLayout`. */
  layout: jsonb("layout").$type<TileConfig[]>().notNull().$defaultFn(() => []),
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
