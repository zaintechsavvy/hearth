import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { camera, integration, preference, scene } from "@/lib/db/schema";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { HearthScene } from "@/lib/scenes/types";
import { parseDeviceId, type Device, type DeviceCommand } from "@/lib/devices/types";
import { createProvider } from "@/lib/integrations/registry";
import { integrationTopic, publish } from "@/lib/live/bus";
import { IntegrationError, type IntegrationKind } from "@/lib/integrations/types";

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

export interface HomeSnapshot {
  devices: Device[];
  integrations: IntegrationStatus[];
  cameras: { id: string; name: string }[];
  scenes: HearthScene[];
  layout: TileConfig[];
}

const LIST_TIMEOUT_MS = 10_000;

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
  return { streamRelayUrl: row?.streamRelayUrl ?? null, layout: row?.layout ?? [] };
}

export async function loadHome(userId: string): Promise<HomeSnapshot> {
  const [rows, preferences, cameras, scenes] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, userId)).orderBy(integration.createdAt),
    getPreferences(userId),
    db.select({ id: camera.id, name: camera.name }).from(camera).where(eq(camera.userId, userId)).orderBy(camera.createdAt),
    db.select({ id: scene.id, name: scene.name, icon: scene.icon, actions: scene.actions }).from(scene).where(eq(scene.userId, userId)).orderBy(scene.createdAt),
  ]);
  const results = await Promise.allSettled(rows.map(row => withTimeout(createProvider(row).listDevices(), LIST_TIMEOUT_MS, `${row.name} took too long to answer.`)));
  const devices: Device[] = [];
  const integrations = rows.map((row, index): IntegrationStatus => {
    const result = results[index];
    const ok = result.status === "fulfilled";
    if (ok) devices.push(...result.value.devices);
    return {
      id: row.id, name: row.name, kind: row.kind, ok,
      error: ok ? null : readableError(result.reason),
      deviceCount: ok ? result.value.devices.length : 0,
      unsupported: ok ? result.value.unsupported : {},
    };
  });
  return { devices, integrations, cameras, scenes, layout: preferences.layout };
}

export async function runCommand(userId: string, id: string, command: DeviceCommand) {
  const parsed = parseDeviceId(id);
  if (!parsed) throw new IntegrationError("Unknown device.");
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) });
  if (!row) throw new IntegrationError("Unknown device.");
  await createProvider(row).execute(parsed.nativeId, command);
  publish(integrationTopic(row.id));
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
  const results = await Promise.allSettled(steps.map(action => runCommand(userId, action.deviceId, action.command)));
  return {
    ran: results.filter(result => result.status === "fulfilled").length,
    failed: results.flatMap((result, index) => result.status === "rejected" ? [{ name: devices.get(steps[index].deviceId)?.name ?? "A device", error: readableError(result.reason) }] : []),
  };
}
