"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { StreamRelay, relayStreamName } from "@/lib/cameras/stream-relay";
import { seal } from "@/lib/crypto";
import { TILE_COLORS, TILE_ICONS, TILE_SIZES } from "@/lib/dashboard/layout";
import { db } from "@/lib/db";
import { camera, integration, preference } from "@/lib/db/schema";
import { getPreferences, readableError, streamRelayUrl } from "@/lib/home";
import { MatterProvider } from "@/lib/integrations/matter/provider";
import { createProvider } from "@/lib/integrations/registry";
import { INTEGRATION_LABELS, IntegrationError, type IntegrationConfig } from "@/lib/integrations/types";
import { getUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a full address, like http://homeassistant.local:8123" });
const wsUrl = z.url({ protocol: /^wss?$/, error: "Enter a WebSocket address, like ws://homeassistant.local:5580/ws" });

const integrationInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home-assistant"), name: z.string().trim().max(60), url: httpUrl, token: z.string().trim().min(20, "Paste a long-lived access token from your Home Assistant profile.") }),
  z.object({ kind: z.literal("matter"), name: z.string().trim().max(60), url: wsUrl }),
  z.object({ kind: z.literal("demo"), name: z.string().trim().max(60) }),
]);

const cameraInput = z.object({
  name: z.string().trim().min(1, "Give the camera a name.").max(60),
  url: z.url({ protocol: /^rtsps?$/, error: "Enter an RTSP address, like rtsp://192.168.1.20:554/stream1" }),
  username: z.string().trim().max(120).optional(),
  password: z.string().max(200).optional(),
});

const OK: ActionResult = { ok: true };

async function authed(run: (userId: string) => Promise<ActionResult>): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Your session ended. Sign in again." };
  try {
    return await run(user.id);
  } catch (error) {
    return { ok: false, error: readableError(error) };
  }
}

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form and try again.";

/** Connects before saving, so a saved integration is one that worked at least once. */
export async function addIntegration(input: unknown): Promise<ActionResult> {
  const parsed = integrationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const { name, ...config } = parsed.data;
    const row = { id: crypto.randomUUID(), userId, kind: config.kind, name: name || INTEGRATION_LABELS[config.kind], config: seal(config satisfies IntegrationConfig), createdAt: new Date() };
    await createProvider(row).check();
    await db.insert(integration).values(row);
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function addDemoHome(): Promise<ActionResult> {
  return addIntegration({ kind: "demo", name: "Demo home" });
}

export async function removeIntegration(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(integration).where(and(eq(integration.id, id), eq(integration.userId, userId)));
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function pairMatterDevice(integrationId: string, code: string): Promise<ActionResult> {
  const cleaned = code.trim().replaceAll(/[\s-]/g, "");
  if (!/^(MT:[0-9A-Z.\-]+|\d{11}|\d{21})$/i.test(cleaned)) return { ok: false, error: "Enter the 11 digit pairing code, or the MT: code from the QR label." };
  return authed(async userId => {
    const row = await db.query.integration.findFirst({ where: and(eq(integration.id, integrationId), eq(integration.userId, userId)) });
    if (!row || row.kind !== "matter") throw new IntegrationError("That Matter server is not connected.");
    const provider = createProvider(row) as MatterProvider;
    await provider.commission(cleaned.toUpperCase().startsWith("MT:") ? `MT:${cleaned.slice(3)}` : cleaned);
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function addCamera(input: unknown): Promise<ActionResult> {
  const parsed = cameraInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const { name, ...source } = parsed.data;
    const id = crypto.randomUUID();
    const cleanSource: CameraSource = { url: source.url, username: source.username || undefined, password: source.password || undefined };
    await new StreamRelay(await streamRelayUrl(userId)).upsert(relayStreamName(id), cleanSource);
    await db.insert(camera).values({ id, userId, name, source: seal(cleanSource) });
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function removeCamera(id: string): Promise<ActionResult> {
  return authed(async userId => {
    const deleted = await db.delete(camera).where(and(eq(camera.id, id), eq(camera.userId, userId))).returning({ id: camera.id });
    if (deleted.length) await new StreamRelay(await streamRelayUrl(userId)).remove(relayStreamName(id)).catch(() => undefined);
    revalidatePath("/", "layout");
    return OK;
  });
}

async function savePreferences(userId: string, patch: Partial<typeof preference.$inferInsert>) {
  const current = await getPreferences(userId);
  await db.insert(preference).values({ userId, ...current, ...patch }).onConflictDoUpdate({ target: preference.userId, set: patch });
}

export async function saveStreamRelay(url: string): Promise<ActionResult> {
  const parsed = httpUrl.safeParse(url.trim());
  if (!parsed.success) return { ok: false, error: "Enter the relay address, like http://192.168.1.10:1984" };
  return authed(async userId => {
    await new StreamRelay(parsed.data).check();
    await savePreferences(userId, { streamRelayUrl: parsed.data });
    revalidatePath("/", "layout");
    return OK;
  });
}

const tileSchema = z.object({
  id: z.string().min(1).max(300),
  size: z.enum(TILE_SIZES),
  icon: z.enum(TILE_ICONS).optional(),
  color: z.enum(TILE_COLORS).optional(),
  hidden: z.boolean().optional(),
});

export async function saveLayout(tiles: unknown): Promise<ActionResult> {
  const parsed = z.array(tileSchema).max(500).safeParse(tiles);
  if (!parsed.success) return { ok: false, error: "That layout is not valid." };
  return authed(async userId => {
    await savePreferences(userId, { layout: parsed.data });
    return OK;
  });
}
