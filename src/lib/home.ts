import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { camera, deviceOverride, integration, preference, scene, widgetItem } from "@/lib/db/schema";
import { unseal } from "@/lib/crypto";
import type { WidgetItem } from "@/lib/widgets/items";
import { HOME_PAGE_ID, withoutOrphanTiles, type DashboardPage, type SavedTile } from "@/lib/dashboard/layout";
import type { HearthScene } from "@/lib/scenes/types";
import { parseDeviceId, type Device, type DeviceCommand, showAs, type SwitchableKind } from "@/lib/devices/types";
import { createProvider } from "@/lib/integrations/registry";
import { integrationTopic, publish } from "@/lib/live/bus";
import { IntegrationError, type IntegrationKind } from "@/lib/integrations/types";
import { noteCommand } from "@/lib/monitor/attribution";
import { DEFAULT_ALERTS } from "@/lib/activity-types";
import { DEFAULT_SECURITY, type OpenMethod } from "@/lib/security-types";
import { isServerless } from "@/lib/setup-check";

export interface IntegrationStatus {
  id: string;
  name: string;
  kind: IntegrationKind;
  ok: boolean;
  error: string | null;
  deviceCount: number;
  /** Things the integration has that Hearth cannot show yet, counted by type. */
  unsupported: Record<string, number>;
}

export interface HomeCamera {
  id: string;
  name: string;
  sourceName?: string;
}

export interface HomeSnapshot {
  devices: Device[];
  integrations: IntegrationStatus[];
  cameras: HomeCamera[];
  scenes: HearthScene[];
  /** The first page's tiles; the same as `pages[0].layout`. */
  layout: SavedTile[];
  pages: DashboardPage[];
  /** Every room in display order: the person's own first, as they arranged them, then the rest alphabetically. */
  rooms: string[];
  /** Bins, medications, countdowns, notes, Wi-Fi, timers, and plants, so every screen updates live. */
  widgets: WidgetItem[];
  /** How opening the home is confirmed here; the PIN itself never leaves the server. */
  openMethod: OpenMethod;
}

type Override = { name: string | null; room: string | null; kind?: SwitchableKind | null };

/** Hearth's names and rooms over the integration's, keeping the originals so they can be shown and restored. */
export function applyOverride<T extends Device>(device: T, override: Override | undefined): T {
  if (!override) return device;
  const next = { ...device };
  if (override.name) {
    next.sourceName = device.name;
    next.name = override.name;
  }
  if (override.room !== null) {
    next.sourceRoom = device.room;
    next.room = override.room || null;
  }
  if (override.kind && override.kind !== device.kind && (next.kind === "light" || next.kind === "switch" || next.kind === "fan")) return showAs(next, override.kind) as T;
  return next;
}

function openWifi(data: Record<string, unknown>) {
  try {
    return { ...data, password: typeof data.password === "string" && data.password ? unseal<string>(data.password) : "" };
  } catch {
    return { ...data, password: "" };
  }
}

export function orderedRooms(custom: string[], devices: { room: string | null }[]) {
  const own = new Set(custom);
  const others = [...new Set(devices.map(device => device.room).filter((room): room is string => Boolean(room) && !own.has(room as string)))].sort((a, b) => a.localeCompare(b));
  return [...custom, ...others];
}

/** A hosted Hearth reaches home over the internet and may be opening its connection cold, so it waits longer. */
const LIST_TIMEOUT_MS = isServerless() ? 20_000 : 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new IntegrationError(message)), ms))]);
}

export function readableError(error: unknown) {
  if (error instanceof IntegrationError) return error.message;
  console.error(error);
  return "Something went wrong. Check the server logs for details.";
}

export async function getPreferences(userId: string) {
  const row = await db.query.preference.findFirst({ where: eq(preference.userId, userId) });
  const layout = row?.layout ?? [];
  const pages: DashboardPage[] = row?.pages.length ? row.pages : [{ id: HOME_PAGE_ID, name: "Home", layout }];
  return { streamRelayUrl: row?.streamRelayUrl ?? null, layout, pages, rooms: row?.rooms ?? [], alerts: { ...DEFAULT_ALERTS, ...row?.alerts }, location: row?.location ?? null, security: row?.security ?? DEFAULT_SECURITY };
}

export async function loadHome(userId: string): Promise<HomeSnapshot> {
  const [rows, preferences, cameraRows, scenes, overrideRows, itemRows] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, userId)).orderBy(integration.createdAt),
    getPreferences(userId),
    db.select({ id: camera.id, name: camera.name }).from(camera).where(eq(camera.userId, userId)).orderBy(camera.createdAt),
    db.select({ id: scene.id, name: scene.name, icon: scene.icon, actions: scene.actions }).from(scene).where(eq(scene.userId, userId)).orderBy(scene.createdAt),
    db.select().from(deviceOverride).where(eq(deviceOverride.userId, userId)),
    db.select().from(widgetItem).where(eq(widgetItem.userId, userId)).orderBy(widgetItem.position, widgetItem.createdAt),
  ]);
  const overrides = new Map(overrideRows.map(row => [row.deviceId, row]));
  const results = await Promise.allSettled(rows.map(row => withTimeout(createProvider(row).listDevices(), LIST_TIMEOUT_MS, `${row.name} took too long to answer.`)));
  const devices: Device[] = [];
  const integrations = rows.map((row, index): IntegrationStatus => {
    const result = results[index];
    const ok = result.status === "fulfilled";
    if (ok) devices.push(...result.value.devices.map(device => applyOverride(device, overrides.get(device.id))));
    return {
      id: row.id, name: row.name, kind: row.kind, ok,
      error: ok ? null : readableError(result.reason),
      deviceCount: ok ? result.value.devices.length : 0,
      unsupported: ok ? result.value.unsupported : {},
    };
  });
  const cameras = cameraRows.map(row => {
    const name = overrides.get(`camera:${row.id}`)?.name;
    return name ? { ...row, name, sourceName: row.name } : row;
  });
  const widgets = itemRows.map(row => ({ id: row.id, kind: row.kind, position: row.position, createdAt: row.createdAt.toISOString(), data: row.kind === "wifi" ? openWifi(row.data) : row.data }) as WidgetItem);
  const connected = new Set(rows.map(row => row.id));
  const pages = preferences.pages.map(page => ({ ...page, layout: withoutOrphanTiles(page.layout, connected) }));
  return { devices, integrations, cameras, scenes, layout: pages[0].layout, pages, rooms: orderedRooms(preferences.rooms, devices), widgets, openMethod: preferences.security.method };
}

/** Sends a device a command. `by` says who, for the activity log: a person, the assistant, a scene, or an automation. */
export async function runCommand(userId: string, id: string, command: DeviceCommand, by?: string) {
  const parsed = parseDeviceId(id);
  if (!parsed) throw new IntegrationError("Unknown device.");
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) });
  if (!row) throw new IntegrationError("Unknown device.");
  if (by) noteCommand(userId, id, by);
  await createProvider(row).execute(parsed.nativeId, command);
  publish(integrationTopic(row.id));
}

/** The provider behind one of this person's devices, with the id that provider knows it by. */
export async function deviceProvider(userId: string, deviceId: string) {
  const parsed = parseDeviceId(deviceId);
  if (!parsed) return null;
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) });
  return row ? { provider: createProvider(row), nativeId: parsed.nativeId } : null;
}

export async function findCamera(userId: string, cameraId: string) {
  return db.query.camera.findFirst({ where: and(eq(camera.id, cameraId), eq(camera.userId, userId)) });
}

export async function streamRelayUrl(userId: string) {
  const { streamRelayUrl } = await getPreferences(userId);
  return streamRelayUrl ?? process.env.STREAM_RELAY_URL ?? "http://localhost:1984";
}

export interface SceneRun {
  ran: number;
  failed: { name: string; error: string }[];
}

/** Runs every step at once; a device that refuses does not stop the others. */
export async function runScene(userId: string, sceneId: string): Promise<SceneRun | null> {
  const row = await db.query.scene.findFirst({ where: and(eq(scene.id, sceneId), eq(scene.userId, userId)) });
  if (!row) return null;
  const home = await loadHome(userId);
  const devices = new Map(home.devices.map(device => [device.id, device]));
  const steps = row.actions.filter(action => devices.has(action.deviceId));
  const results = await Promise.allSettled(steps.map(action => runCommand(userId, action.deviceId, action.command, `the ${row.name} scene`)));
  return {
    ran: results.filter(result => result.status === "fulfilled").length,
    failed: results.flatMap((result, index) => result.status === "rejected" ? [{ name: devices.get(steps[index].deviceId)?.name ?? "A device", error: readableError(result.reason) }] : []),
  };
}
