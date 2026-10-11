import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { TileConfig } from "@/lib/dashboard/layout";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => timestamp("created_at").notNull().$defaultFn(() => new Date());
const updatedAt = () => timestamp("updated_at").notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date());

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index("session_user_idx").on(t.userId)]);

export const account = sqliteTable("account", {
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

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const integration = sqliteTable("integration", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["home-assistant", "matter", "demo"] }).notNull(),
  name: text("name").notNull(),
  /** Sealed with `lib/crypto`: holds URLs and access tokens. */
  config: text("config").notNull(),
  createdAt: createdAt(),
}, t => [index("integration_user_idx").on(t.userId)]);

export const camera = sqliteTable("camera", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Sealed `CameraSource`: the RTSP URL and its credentials never leave the server. */
  source: text("source").notNull(),
  createdAt: createdAt(),
}, t => [index("camera_user_idx").on(t.userId)]);

export const preference = sqliteTable("preference", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  streamRelayUrl: text("stream_relay_url"),
  /** Dashboard tiles in display order. Reconciled with live devices by `resolveLayout`. */
  layout: text("layout", { mode: "json" }).$type<TileConfig[]>().notNull().$defaultFn(() => []),
  updatedAt: updatedAt(),
});

export const assistant = sqliteTable("assistant", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["anthropic", "openai", "xai", "gemini", "meta"] }).notNull(),
  model: text("model").notNull(),
  /** Sealed with `lib/crypto`. */
  apiKey: text("api_key").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
}, t => [index("assistant_user_idx").on(t.userId)]);
