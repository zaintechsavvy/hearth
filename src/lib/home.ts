import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { camera, integration, preference } from "@/lib/db/schema";
import { parseDeviceId, type Device, type DeviceCommand } from "@/lib/devices/types";
import { createProvider } from "@/lib/integrations/registry";
import { IntegrationError, type IntegrationKind } from "@/lib/integrations/types";

export interface IntegrationStatus {
  id: string;
  name: string;
  kind: IntegrationKind;
  ok: boolean;
  error: string | null;
  deviceCount: number;
}

export interface HomeSnapshot {
  devices: Device[];
  integrations: IntegrationStatus[];
  hiddenDevices: string[];
  thermostatId: string | null;
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
  return { streamRelayUrl: row?.streamRelayUrl ?? null, hiddenDevices: row?.hiddenDevices ?? [], thermostatId: row?.thermostatId ?? null };
}

export async function loadHome(userId: string): Promise<HomeSnapshot> {
  const [rows, preferences] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, userId)).orderBy(integration.createdAt),
    getPreferences(userId),
  ]);
  const results = await Promise.allSettled(rows.map(row => withTimeout(createProvider(row).listDevices(), LIST_TIMEOUT_MS, `${row.name} took too long to answer.`)));
  const devices: Device[] = [];
  const integrations = rows.map((row, index): IntegrationStatus => {
    const result = results[index];
    const ok = result.status === "fulfilled";
    if (ok) devices.push(...result.value);
    return { id: row.id, name: row.name, kind: row.kind, ok, error: ok ? null : readableError(result.reason), deviceCount: ok ? result.value.length : 0 };
  });
  return { devices, integrations, hiddenDevices: preferences.hiddenDevices, thermostatId: preferences.thermostatId };
}

export async function runCommand(userId: string, id: string, command: DeviceCommand) {
  const parsed = parseDeviceId(id);
  if (!parsed) throw new IntegrationError("Unknown device.");
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) });
  if (!row) throw new IntegrationError("Unknown device.");
  await createProvider(row).execute(parsed.nativeId, command);
}

export async function findCamera(userId: string, cameraId: string) {
  return db.query.camera.findFirst({ where: and(eq(camera.id, cameraId), eq(camera.userId, userId)) });
}

export async function streamRelayUrl(userId: string) {
  const { streamRelayUrl } = await getPreferences(userId);
  return streamRelayUrl ?? process.env.STREAM_RELAY_URL ?? "http://localhost:1984";
}
