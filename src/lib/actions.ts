"use server";

import { authed, firstIssue, OK, ownerOnly, type ActionResult, type CreatedResult } from "@/lib/action-helpers";
import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { StreamRelay, relayStreamName } from "@/lib/cameras/stream-relay";
import { ASSISTANT_PROVIDER_IDS, ASSISTANT_PROVIDERS } from "@/lib/assistant/providers";
import { checkAssistantKey } from "@/lib/assistant/run";
import { seal } from "@/lib/crypto";
import { createTile, HOME_PAGE_ID, suggestedTiles, TILE_COLORS, TILE_ICONS, TILE_KINDS, TILE_SIZES, withoutOrphanTiles, type TileHold } from "@/lib/dashboard/layout";
import { tileSources } from "@/lib/dashboard/sources";
import { db } from "@/lib/db";
import { assistant, automation, calendar, camera, deviceOverride, integration, preference, reminder, scene } from "@/lib/db/schema";
import { automationInput } from "@/lib/automations/types";
import { isSensitive } from "@/lib/devices/types";
import { runAutomationNow } from "@/lib/monitor/automations";
import { getPreferences, loadHome, orderedRooms, streamRelayUrl } from "@/lib/home";
import { parseDeviceId } from "@/lib/devices/types";
import { saveScene } from "@/lib/scenes/service";
import { isServerless } from "@/lib/setup-check";
import { hashPin } from "@/lib/security";
import { PIN_PATTERN } from "@/lib/security-types";
import { MatterProvider } from "@/lib/integrations/matter/provider";
import { createProvider } from "@/lib/integrations/registry";
import { INTEGRATION_LABELS, IntegrationError, type IntegrationConfig } from "@/lib/integrations/types";
import { feedUrl, fetchFeed, forgetCalendar } from "@/lib/widgets/calendar";
import { eventsBetween } from "@/lib/widgets/ical";

export type { ActionResult, CreatedResult } from "@/lib/action-helpers";

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
  /** A Home Assistant connection to add it to, or none for the go2rtc relay. */
  integrationId: z.string().max(100).optional(),
});





/** Connects before saving, so a saved integration is one that worked at least once. */
export async function addIntegration(input: unknown): Promise<CreatedResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = integrationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const id = crypto.randomUUID();
  const result = await authed(async userId => {
    const { name, ...config } = parsed.data;
    const row = { id, userId, kind: config.kind, name: name || INTEGRATION_LABELS[config.kind], config: seal(config satisfies IntegrationConfig), createdAt: new Date() };
    await createProvider(row).check();
    await db.insert(integration).values(row);
    revalidatePath("/", "layout");
    return OK;
  });
  return result.ok ? { ok: true, id } : result;
}

/** The demo home also fills an empty dashboard, so there is something to try straight away. */
export async function addDemoHome(): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const result = await addIntegration({ kind: "demo", name: "Demo home" });
  if (!result.ok) return result;
  return authed(async userId => {
    const home = await loadHome(userId);
    if (home.layout.length === 0) {
      const layout = [createTile("clock"), ...suggestedTiles(tileSources(home))];
      await savePreferences(userId, { layout, pages: home.pages.map((page, index) => index === 0 ? { ...page, layout } : page) });
    }
    return OK;
  });
}

export async function removeIntegration(id: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  return authed(async userId => {
    const removed = await db.delete(integration).where(and(eq(integration.id, id), eq(integration.userId, userId))).returning({ id: integration.id });
    if (removed.length) {
      // Its tiles and per-device names go with it, so connecting again starts from an empty dashboard.
      const remaining = new Set((await db.select({ id: integration.id }).from(integration).where(eq(integration.userId, userId))).map(row => row.id));
      const { layout, pages } = await getPreferences(userId);
      await savePreferences(userId, { layout: withoutOrphanTiles(layout, remaining), pages: pages.map(page => ({ ...page, layout: withoutOrphanTiles(page.layout, remaining) })) });
      await db.delete(deviceOverride).where(and(eq(deviceOverride.userId, userId), like(deviceOverride.deviceId, `${id}:%`)));
    }
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function pairMatterDevice(integrationId: string, code: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
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
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = cameraInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const { name, integrationId, ...source } = parsed.data;
    const id = crypto.randomUUID();
    const cleanSource: CameraSource = { url: source.url, username: source.username || undefined, password: source.password || undefined };
    if (integrationId) {
      const row = await db.query.integration.findFirst({ where: and(eq(integration.id, integrationId), eq(integration.userId, userId)) });
      const provider = row && createProvider(row);
      if (!provider?.addRtspCamera) throw new IntegrationError("That connection cannot add cameras.");
      await provider.addRtspCamera(cleanSource, name);
      revalidatePath("/", "layout");
      return OK;
    }
    const relayUrl = await streamRelayUrl(userId);
    await new StreamRelay(relayUrl).upsert(relayStreamName(id), cleanSource).catch(error => {
      if (isServerless() && new URL(relayUrl).hostname === "localhost") throw new IntegrationError("This Hearth runs in the cloud, so it has no go2rtc beside it. Add the camera through Home Assistant, or set a stream relay address this server can reach.");
      throw error;
    });
    await db.insert(camera).values({ id, userId, name, source: seal(cleanSource) });
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function removeCamera(id: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
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
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = httpUrl.safeParse(url.trim());
  if (!parsed.success) return { ok: false, error: "Enter the relay address, like http://192.168.1.10:1984" };
  return authed(async userId => {
    await new StreamRelay(parsed.data).check();
    await savePreferences(userId, { streamRelayUrl: parsed.data });
    revalidatePath("/", "layout");
    return OK;
  });
}

const placeSchema = z.object({ name: z.string().max(120), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });

const tileSchema = z.object({
  id: z.string().min(1).max(300),
  kind: z.enum(TILE_KINDS),
  link: z.string().min(1).max(300).nullable(),
  size: z.enum(TILE_SIZES),
  icon: z.enum(TILE_ICONS).optional(),
  color: z.enum(TILE_COLORS).optional(),
  label: z.string().trim().max(60).optional(),
  options: z.object({
    place: placeSchema.optional(),
    units: z.enum(["C", "F"]).optional(),
    calendars: z.array(z.string().max(100)).max(20).optional(),
    itemId: z.string().max(100).optional(),
    hideRoom: z.boolean().optional(),
    hideStatus: z.boolean().optional(),
    glow: z.boolean().optional(),
    price: z.number().min(0).max(10).optional(),
    speakers: z.array(z.string().max(300)).max(20).optional(),
    presets: z.array(z.object({ label: z.string().trim().min(1).max(30), minutes: z.number().min(0.25).max(1440) })).max(8).optional(),
    hold: z.custom<TileHold>(value => typeof value === "string" && /^(controls|history|none|scene:[\w-]{1,100}|device:[\w.:-]{1,300})$/.test(value)).optional(),
  }).optional(),
});

/** Saves one page's tiles. The first page also keeps the original `layout` column current. */
export async function saveLayout(tiles: unknown, pageId: string = HOME_PAGE_ID): Promise<ActionResult> {
  const parsed = z.array(tileSchema).max(500).safeParse(tiles);
  if (!parsed.success) return { ok: false, error: "That layout is not valid." };
  return authed(async userId => {
    const { pages } = await getPreferences(userId);
    const index = pages.findIndex(page => page.id === pageId);
    if (index < 0) throw new IntegrationError("That page is gone. Reload the page.");
    const next = pages.map((page, position) => position === index ? { ...page, layout: parsed.data } : page);
    await savePreferences(userId, { pages: next, layout: next[0].layout });
    return OK;
  });
}

const pageName = z.string().trim().min(1, "Give the page a name.").max(30, "Keep page names under 30 characters.");

export async function addPage(name: unknown): Promise<CreatedResult> {
  const parsed = pageName.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const id = `page-${crypto.randomUUID()}`;
  const result = await authed(async userId => {
    const { pages } = await getPreferences(userId);
    if (pages.length >= 12) throw new IntegrationError("You can have up to 12 pages.");
    await savePreferences(userId, { pages: [...pages, { id, name: parsed.data, layout: [] }] });
    return OK;
  });
  return result.ok ? { ok: true, id } : result;
}

export async function renamePage(id: string, name: unknown): Promise<ActionResult> {
  const parsed = pageName.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const { pages } = await getPreferences(userId);
    await savePreferences(userId, { pages: pages.map(page => page.id === id ? { ...page, name: parsed.data } : page) });
    return OK;
  });
}

export async function deletePage(id: string): Promise<ActionResult> {
  return authed(async userId => {
    const { pages } = await getPreferences(userId);
    if (pages.length <= 1) throw new IntegrationError("Keep at least one page.");
    const next = pages.filter(page => page.id !== id);
    await savePreferences(userId, { pages: next, layout: next[0].layout });
    return OK;
  });
}

export async function movePage(id: string, by: number): Promise<ActionResult> {
  return authed(async userId => {
    const { pages } = await getPreferences(userId);
    const from = pages.findIndex(page => page.id === id);
    const to = from + Math.sign(by);
    if (from < 0 || to < 0 || to >= pages.length) return OK;
    const next = [...pages];
    [next[from], next[to]] = [next[to], next[from]];
    await savePreferences(userId, { pages: next, layout: next[0].layout });
    return OK;
  });
}

const assistantInput = z.object({
  provider: z.enum(ASSISTANT_PROVIDER_IDS),
  apiKey: z.string().trim().max(500),
  model: z.string().trim().max(100).optional(),
  baseUrl: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (value.provider === "custom") {
    if (!httpUrl.safeParse(value.baseUrl).success) context.addIssue({ code: "custom", message: "Enter the server address, like http://localhost:11434/v1" });
  } else if (value.apiKey.length < 10) {
    context.addIssue({ code: "custom", message: "Paste the full API key." });
  }
});

/** Checks the key against the provider before saving. The first assistant becomes the default. */
export async function addAssistant(input: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = assistantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { provider } = parsed.data;
  return authed(async userId => {
    const baseUrl = provider === "custom" ? parsed.data.baseUrl?.replace(/\/+$/, "") ?? null : null;
    await checkAssistantKey(provider, parsed.data.apiKey, baseUrl);
    const existing = await db.select({ id: assistant.id }).from(assistant).where(eq(assistant.userId, userId)).limit(1);
    await db.insert(assistant).values({
      userId,
      provider,
      model: parsed.data.model || ASSISTANT_PROVIDERS[provider].defaultModel,
      apiKey: seal(parsed.data.apiKey),
      baseUrl,
      isDefault: existing.length === 0,
    });
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function removeAssistant(id: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  return authed(async userId => {
    await db.delete(assistant).where(and(eq(assistant.id, id), eq(assistant.userId, userId)));
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function setDefaultAssistant(id: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  return authed(async userId => {
    await db.transaction(async tx => {
      await tx.update(assistant).set({ isDefault: false }).where(eq(assistant.userId, userId));
      await tx.update(assistant).set({ isDefault: true }).where(and(eq(assistant.id, id), eq(assistant.userId, userId)));
    });
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function createScene(input: unknown): Promise<ActionResult> {
  return authed(async userId => {
    const result = await saveScene(userId, input);
    return result.ok ? OK : result;
  });
}

export async function updateScene(id: string, input: unknown): Promise<ActionResult> {
  return authed(async userId => {
    const result = await saveScene(userId, input, id);
    return result.ok ? OK : result;
  });
}

export async function deleteScene(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(scene).where(and(eq(scene.id, id), eq(scene.userId, userId)));
    return OK;
  });
}

const calendarInput = z.object({
  name: z.string().trim().min(1, "Give the calendar a name.").max(60),
  url: z.string().trim().transform(feedUrl).pipe(z.url({ protocol: /^https?$/, error: "Paste the full address, starting with https:// or webcal://" })),
  color: z.enum(TILE_COLORS),
});

/** Reads the feed once before saving, so a saved calendar is one that worked. */
export async function addCalendar(input: unknown): Promise<ActionResult> {
  const parsed = calendarInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    eventsBetween(await fetchFeed(parsed.data.url), "check", new Date(), new Date());
    await db.insert(calendar).values({ userId, name: parsed.data.name, color: parsed.data.color, url: seal(parsed.data.url) });
    revalidatePath("/", "layout");
    return OK;
  });
}

export async function removeCalendar(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(calendar).where(and(eq(calendar.id, id), eq(calendar.userId, userId)));
    forgetCalendar(id);
    revalidatePath("/", "layout");
    return OK;
  });
}

const reminderInput = z.object({
  title: z.string().trim().min(1, "Write the reminder first.").max(200),
  dueAt: z.iso.datetime({ offset: true }).nullish(),
});

export async function addReminder(input: unknown): Promise<ActionResult> {
  const parsed = reminderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    await db.insert(reminder).values({ userId, title: parsed.data.title, dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null });
    return OK;
  });
}

export async function setReminderDone(id: string, done: boolean): Promise<ActionResult> {
  return authed(async userId => {
    await db.update(reminder).set({ doneAt: done ? new Date() : null }).where(and(eq(reminder.id, id), eq(reminder.userId, userId)));
    return OK;
  });
}

export async function removeReminder(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(reminder).where(and(eq(reminder.id, id), eq(reminder.userId, userId)));
    return OK;
  });
}

const roomName = z.string().trim().min(1, "Give the room a name.").max(40, "Keep room names under 40 characters.");
const deviceChange = z.object({
  /** Null restores the integration's name. */
  name: z.string().trim().max(60, "Keep names under 60 characters.").nullable().optional(),
  /** Null restores the integration's room; an empty string means no room. */
  room: z.union([roomName, z.literal("")]).nullable().optional(),
});

async function ownsTarget(userId: string, id: string) {
  if (id.startsWith("camera:")) return Boolean(await db.query.camera.findFirst({ where: and(eq(camera.id, id.slice(7)), eq(camera.userId, userId)) }));
  const parsed = parseDeviceId(id);
  return Boolean(parsed && await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) }));
}

async function writeOverride(userId: string, deviceId: string, change: { name?: string | null; room?: string | null }) {
  const current = await db.query.deviceOverride.findFirst({ where: and(eq(deviceOverride.userId, userId), eq(deviceOverride.deviceId, deviceId)) });
  const next = { name: change.name === undefined ? current?.name ?? null : change.name || null, room: change.room === undefined ? current?.room ?? null : change.room };
  if (next.name === null && next.room === null) {
    await db.delete(deviceOverride).where(and(eq(deviceOverride.userId, userId), eq(deviceOverride.deviceId, deviceId)));
    return;
  }
  await db.insert(deviceOverride).values({ userId, deviceId, ...next }).onConflictDoUpdate({ target: [deviceOverride.userId, deviceOverride.deviceId], set: next });
}

/** Renames a device or moves it to another room in Hearth only; the integration keeps its own name and area. */
export async function updateDevice(deviceId: string, change: unknown): Promise<ActionResult> {
  const parsed = deviceChange.safeParse(change);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    if (!(await ownsTarget(userId, deviceId))) throw new IntegrationError("That device is not in your home.");
    if (parsed.data.room) await rememberRoom(userId, parsed.data.room);
    await writeOverride(userId, deviceId, parsed.data);
    return OK;
  });
}

async function rememberRoom(userId: string, room: string) {
  const { rooms } = await getPreferences(userId);
  if (!rooms.includes(room)) await savePreferences(userId, { rooms: [...rooms, room] });
}

export async function addRoom(name: unknown): Promise<ActionResult> {
  const parsed = roomName.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    await rememberRoom(userId, parsed.data);
    return OK;
  });
}

/** Renames a room everywhere it shows, including rooms that came from Home Assistant, by moving each device in it. */
export async function renameRoom(from: string, to: unknown): Promise<ActionResult> {
  const parsed = roomName.safeParse(to);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const home = await loadHome(userId);
    for (const device of home.devices.filter(item => item.room === from)) await writeOverride(userId, device.id, { room: parsed.data });
    const rooms = orderedRooms((await getPreferences(userId)).rooms, home.devices);
    await savePreferences(userId, { rooms: [...new Set(rooms.map(room => room === from ? parsed.data : room))] });
    return OK;
  });
}

/** Deletes a room; its devices move to no room rather than back to wherever the integration had them. */
export async function removeRoom(name: string): Promise<ActionResult> {
  return authed(async userId => {
    const home = await loadHome(userId);
    for (const device of home.devices.filter(item => item.room === name)) await writeOverride(userId, device.id, { room: "" });
    const { rooms } = await getPreferences(userId);
    await savePreferences(userId, { rooms: rooms.filter(room => room !== name) });
    return OK;
  });
}

export async function reorderRooms(order: unknown): Promise<ActionResult> {
  const parsed = z.array(roomName).max(100).safeParse(order);
  if (!parsed.success) return { ok: false, error: "That room order is not valid." };
  return authed(async userId => {
    await savePreferences(userId, { rooms: [...new Set(parsed.data)] });
    return OK;
  });
}

const alertSettings = z.object({
  doorbell: z.boolean(), safety: z.boolean(), locks: z.boolean(), timers: z.boolean(), medications: z.boolean(),
  openMinutes: z.number().int().min(0).max(240),
});

export async function saveAlerts(input: unknown): Promise<ActionResult> {
  const parsed = alertSettings.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those alert settings are not valid." };
  return authed(async userId => {
    await savePreferences(userId, { alerts: parsed.data });
    return OK;
  });
}

/** Saves a rule after checking it can never unlock a door or open a garage, door, or gate. */
export async function saveAutomation(input: unknown, id?: string): Promise<CreatedResult> {
  const parsed = automationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  let saved = id ?? "";
  const result = await authed(async userId => {
    const devices = new Map((await loadHome(userId)).devices.map(device => [device.id, device]));
    for (const action of parsed.data.actions) {
      if (action.type !== "device") continue;
      const device = devices.get(action.deviceId);
      if (!device) throw new IntegrationError("One of the devices in this automation is gone.");
      if (isSensitive(device, action.command)) throw new IntegrationError(`For safety, automations cannot unlock or open ${device.name}.`);
    }
    if (id) {
      const updated = await db.update(automation).set(parsed.data).where(and(eq(automation.id, id), eq(automation.userId, userId))).returning({ id: automation.id });
      if (!updated.length) throw new IntegrationError("That automation is gone.");
    } else {
      const [row] = await db.insert(automation).values({ userId, ...parsed.data }).returning({ id: automation.id });
      saved = row.id;
    }
    return OK;
  });
  return result.ok ? { ok: true, id: saved } : result;
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  return authed(async userId => {
    await db.update(automation).set({ enabled }).where(and(eq(automation.id, id), eq(automation.userId, userId)));
    return OK;
  });
}

/** Pauses an automation until the given time, at most a week away, or resumes it with null. */
export async function snoozeAutomation(id: string, until: string | null): Promise<ActionResult> {
  const time = until === null ? null : new Date(until);
  if (time && (Number.isNaN(time.getTime()) || time.getTime() <= Date.now() || time.getTime() - Date.now() > 7 * 86_400_000)) return { ok: false, error: "Pick a time in the next week." };
  return authed(async userId => {
    await db.update(automation).set({ snoozedUntil: time }).where(and(eq(automation.id, id), eq(automation.userId, userId)));
    return OK;
  });
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(automation).where(and(eq(automation.id, id), eq(automation.userId, userId)));
    return OK;
  });
}

export async function runAutomation(id: string): Promise<ActionResult> {
  return authed(async userId => {
    if (!(await runAutomationNow(userId, id))) throw new IntegrationError("That automation is gone.");
    return OK;
  });
}

const locationInput = z.object({ name: z.string().trim().min(1).max(80), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });

export async function saveHomeLocation(input: unknown): Promise<ActionResult> {
  const parsed = locationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a place from the list." };
  return authed(async userId => {
    await savePreferences(userId, { location: parsed.data });
    return OK;
  });
}

/** Chooses how opening the home is confirmed. Switching to a PIN, or changing it, needs the new PIN. */
export async function setOpenMethod(method: unknown, pin?: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = z.enum(["hold", "pin"]).safeParse(method);
  if (!parsed.success) return { ok: false, error: "Pick hold or PIN." };
  return authed(async userId => {
    const { security } = await getPreferences(userId);
    if (parsed.data === "hold") {
      await savePreferences(userId, { security: { ...security, method: "hold" } });
      return OK;
    }
    if (pin === undefined && security.hash) {
      await savePreferences(userId, { security: { ...security, method: "pin" } });
      return OK;
    }
    if (!pin || !PIN_PATTERN.test(pin)) return { ok: false, error: "Use 4 to 8 digits." };
    await savePreferences(userId, { security: { method: "pin", ...hashPin(pin) } });
    return OK;
  });
}
