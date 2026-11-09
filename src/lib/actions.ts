"use server";

import { authed, firstIssue, OK, ownerOnly, type ActionResult, type CreatedResult } from "@/lib/action-helpers";
import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { StreamRelay, relayStreamName } from "@/lib/cameras/stream-relay";
import { ASSISTANT_PROVIDER_IDS, ASSISTANT_PROVIDERS, matchModel, providerOfKey, type AssistantProvider } from "@/lib/assistant/providers";
import { checkAssistantKey } from "@/lib/assistant/run";
import { seal, unseal } from "@/lib/crypto";
import { createTile, HOME_PAGE_ID, newTileId, suggestedTiles, type TileConfig, TILE_COLORS, TILE_ICONS, TILE_KINDS, TILE_SIZES, withoutOrphanTiles, type TileHold } from "@/lib/dashboard/layout";
import { tileSources } from "@/lib/dashboard/sources";
import { db } from "@/lib/db";
import { assistant, automation, calendar, camera, deviceOverride, integration, preference, reminder, scene } from "@/lib/db/schema";
import { automationInput } from "@/lib/automations/types";
import { isSensitive, SWITCHABLE_KINDS, type SwitchableKind } from "@/lib/devices/types";
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
import { checkTransitKey } from "@/lib/transit";
import { albumId, albumPhotos } from "@/lib/photos";
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
    if (config.kind === "demo") await placeDemoTiles(userId, id);
    revalidatePath("/", "layout");
    return OK;
  });
  return result.ok ? { ok: true, id } : result;
}

/** Kinds the demo's own widgets already cover, Energy and Who's home, so each does not take a tile too. */
const DEMO_LEFT_OUT = new Set(["sensor", "todo", "person"]);
/** Kinds that sit best as a single square in the demo: a door you tap to lock or open. */
const DEMO_SQUARE = new Set(["lock", "cover"]);
const DEMO_PLACE = { name: "Toronto", region: "Ontario, Canada", latitude: 43.6532, longitude: -79.3832 };

/**
 * A demo home arrives with its devices already on the first page, after whatever is there, so there is something to
 * try straight away. On an empty dashboard it also brings the widgets worth seeing, with sample departures.
 */
async function placeDemoTiles(userId: string, integrationId: string) {
  const home = await loadHome(userId);
  const placed = new Set(home.layout.map(tile => tile.kind === undefined ? tile.id : tile.link));
  const sources = tileSources(home).filter(source => source.id.startsWith(`${integrationId}:`) && !placed.has(source.id) && !DEMO_LEFT_OUT.has(source.kind));
  const suggested = suggestedTiles(sources.filter(source => source.kind !== "camera")).map(tile => DEMO_SQUARE.has(tile.kind) ? { ...tile, size: "1x1" as const } : tile);
  if (!suggested.length) return;
  const empty = home.layout.length === 0;
  const take = (native: string, size: TileConfig["size"]) => {
    const index = suggested.findIndex(tile => tile.link === `${integrationId}:${native}`);
    return index < 0 ? [] : [{ ...suggested.splice(index, 1)[0], size }];
  };
  const porchCamera = sources.find(source => source.kind === "camera");
  // The first two rows of an 8 column grid: the front door, the week's weather and the garage, then the porch camera and the thermostat.
  const lead = empty ? [
    ...take("front-lock", "2x2"),
    createTile("weather", null, false, { size: "4x2", options: { place: DEMO_PLACE } }),
    ...take("garage", "2x2"),
    ...(porchCamera ? [{ id: newTileId(), kind: "camera" as const, link: porchCamera.id, size: "4x2" as const, options: { video: "snapshots" as const, every: 30 } }] : []),
    ...take("thermostat", "2x2"),
    createTile("people"),
    ...take("alarm", "2x1"),
    createTile("activity", null, false, { size: "2x3" }),
  ] : [];
  const layout = [...home.layout, ...lead, ...suggested];
  const pages = home.pages.map((page, index) => index === 0 ? { ...page, layout } : page);
  await savePreferences(userId, { layout, pages });
}

export async function addDemoHome(): Promise<ActionResult> {
  const result = await addIntegration({ kind: "demo", name: "Demo home" });
  return result.ok ? OK : result;
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

const cellSchema = z.object({ column: z.number().int().min(0).max(7), row: z.number().int().min(0).max(999) });

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
    stops: z.array(z.object({ key: z.string().min(1).max(200), name: z.string().trim().min(1).max(120) })).max(4).optional(),
    video: z.enum(["live", "snapshots"]).optional(),
    every: z.number().int().min(5).max(900).optional(),
    camera: z.string().min(1).max(300).optional(),
    advanced: z.boolean().optional(),
    controls: z.array(z.string().min(1).max(300)).max(8).optional(),
    cameraOpens: z.custom<"view" | `page:${string}`>(value => typeof value === "string" && /^(view|page:[\w-]{1,100})$/.test(value)).optional(),
    hold: z.custom<TileHold>(value => typeof value === "string" && /^(controls|history|none|scene:[\w-]{1,100}|device:[\w.:-]{1,300})$/.test(value)).optional(),
  }).optional(),
  at: z.object({ 4: cellSchema.optional(), 6: cellSchema.optional(), 8: cellSchema.optional() }).optional(),
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

/** The model id to save: what was typed when the provider lists it, the listed id it names, or an error with ids to try. */
function modelFor(provider: AssistantProvider, typed: string, ids: string[]): { model: string } | { error: string } {
  if (ids.length === 0) return { model: typed };
  const model = matchModel(typed, ids);
  if (model) return { model };
  const close = ids.filter(id => id.toLowerCase().includes(typed.toLowerCase().split(/\s+/)[0] ?? "")).slice(0, 3);
  const company = ASSISTANT_PROVIDERS[provider].company;
  return { error: `${company} has no model called "${typed}". ${close.length ? `Try ${close.join(", ")}.` : `Try ${ASSISTANT_PROVIDERS[provider].defaultModel}.`}` };
}

/** Checks the key and the model against the provider before saving. The first assistant becomes the default. */
export async function addAssistant(input: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = assistantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  // A Groq key under Grok, or the reverse, goes to the provider the key is for.
  const chosen = parsed.data.provider;
  const provider = chosen !== "custom" ? providerOfKey(parsed.data.apiKey) ?? chosen : chosen;
  const typed = !parsed.data.model || (provider !== chosen && parsed.data.model === ASSISTANT_PROVIDERS[chosen].defaultModel) ? ASSISTANT_PROVIDERS[provider].defaultModel : parsed.data.model;
  return authed(async userId => {
    const baseUrl = provider === "custom" ? parsed.data.baseUrl?.replace(/\/+$/, "") ?? null : null;
    const found = modelFor(provider, typed, await checkAssistantKey(provider, parsed.data.apiKey, baseUrl));
    if ("error" in found) return { ok: false, error: found.error };
    const existing = await db.select({ id: assistant.id }).from(assistant).where(eq(assistant.userId, userId)).limit(1);
    await db.insert(assistant).values({
      userId,
      provider,
      model: found.model,
      apiKey: seal(parsed.data.apiKey),
      baseUrl,
      isDefault: existing.length === 0,
    });
    revalidatePath("/", "layout");
    return OK;
  });
}

const assistantChange = z.object({
  model: z.string().trim().min(1, "Enter a model.").max(100),
  apiKey: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().optional(),
});

/** Changes an assistant's model, and its key or server address when new ones are given, checking them with the provider first. */
export async function updateAssistant(id: string, input: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = assistantChange.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    const row = await db.query.assistant.findFirst({ where: and(eq(assistant.id, id), eq(assistant.userId, userId)) });
    if (!row) return { ok: false, error: "That assistant is no longer connected." };
    const apiKey = parsed.data.apiKey || unseal<string>(row.apiKey);
    const baseUrl = row.provider === "custom" ? parsed.data.baseUrl?.replace(/\/+$/, "") || row.baseUrl : null;
    if (row.provider === "custom" && !httpUrl.safeParse(baseUrl).success) return { ok: false, error: "Enter the server address, like http://localhost:11434/v1" };
    const found = modelFor(row.provider, parsed.data.model, await checkAssistantKey(row.provider, apiKey, baseUrl));
    if ("error" in found) return { ok: false, error: found.error };
    await db.update(assistant).set({ model: found.model, baseUrl, ...(parsed.data.apiKey ? { apiKey: seal(parsed.data.apiKey) } : {}) }).where(eq(assistant.id, id));
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

export async function createScene(input: unknown): Promise<CreatedResult> {
  let id = "";
  const result = await authed(async userId => {
    const saved = await saveScene(userId, input);
    if (!saved.ok) return saved;
    id = saved.id;
    return OK;
  });
  return result.ok ? { ok: true, id } : result;
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
  /** Null shows it as the integration's own kind. */
  kind: z.enum(SWITCHABLE_KINDS).nullable().optional(),
  /** A doorbell's camera; null finds the matching one. */
  camera: z.string().max(300).nullable().optional(),
  /** Leave it out of Activity. */
  quiet: z.boolean().optional(),
});

async function ownsTarget(userId: string, id: string) {
  if (id.startsWith("camera:")) return Boolean(await db.query.camera.findFirst({ where: and(eq(camera.id, id.slice(7)), eq(camera.userId, userId)) }));
  const parsed = parseDeviceId(id);
  return Boolean(parsed && await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, userId)) }));
}

async function writeOverride(userId: string, deviceId: string, change: { name?: string | null; room?: string | null; kind?: SwitchableKind | null; camera?: string | null; quiet?: boolean }) {
  const current = await db.query.deviceOverride.findFirst({ where: and(eq(deviceOverride.userId, userId), eq(deviceOverride.deviceId, deviceId)) });
  const next = {
    name: change.name === undefined ? current?.name ?? null : change.name || null,
    room: change.room === undefined ? current?.room ?? null : change.room,
    kind: change.kind === undefined ? current?.kind ?? null : change.kind,
    camera: change.camera === undefined ? current?.camera ?? null : change.camera,
    quiet: change.quiet ?? current?.quiet ?? false,
  };
  if (next.name === null && next.room === null && next.kind === null && next.camera === null && !next.quiet) {
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
const bedtimeChoice = z.enum(["do", "check", "skip"]);
const bedtimeInput = z.object({
  locks: bedtimeChoice,
  doors: bedtimeChoice,
  lights: z.enum(["do", "skip"]),
  alarm: bedtimeChoice,
  openings: z.enum(["check", "skip"]),
  turnOn: z.array(z.string().max(300)).max(100),
  turnOff: z.array(z.string().max(300)).max(100),
  keep: z.array(z.string().max(300)).max(200),
});

const immichInput = z.object({ url: httpUrl, key: z.string().trim().max(200), album: z.string().trim().max(400) });

/** Connects an Immich album to the wall tablet's photo frame, once Immich opens it with the key. An empty key keeps the saved one. */
export async function saveImmich(input: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = immichInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const album = albumId(parsed.data.album);
  if (!album) return { ok: false, error: "Paste the album's address from Immich, or its id." };
  return authed(async userId => {
    const { photos } = await getPreferences(userId);
    const key = parsed.data.key || (photos ? unseal<string>(photos.key) : "");
    if (!key) return { ok: false, error: "Paste an Immich API key." };
    const url = parsed.data.url.replace(/\/+$/, "");
    const found = await albumPhotos({ url, key, album });
    if (found.photos.length === 0) return { ok: false, error: `${found.name} has no photos yet.` };
    await savePreferences(userId, { photos: { url, key: seal(key), album } });
    return OK;
  });
}

export async function removeImmich(): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  return authed(async userId => {
    await savePreferences(userId, { photos: null });
    return OK;
  });
}

/** Departures tiles show made-up stops and times until a real Transitland key is added. */
export async function chooseSampleTransit(): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  return authed(async userId => {
    await savePreferences(userId, { transit: { key: seal("sample"), sample: true } });
    return OK;
  });
}

/** Saves the free Transitland key the departures tile uses, once Transitland accepts it. */
export async function saveTransitKey(key: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = z.string().trim().min(10, "Paste the full API key.").max(200).safeParse(key);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    await checkTransitKey(parsed.data);
    await savePreferences(userId, { transit: { key: seal(parsed.data) } });
    return OK;
  });
}

/** What the good night check does, for the whole household. */
export async function saveBedtime(input: unknown): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const parsed = bedtimeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return authed(async userId => {
    await savePreferences(userId, { bedtime: parsed.data });
    return OK;
  });
}

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
    await savePreferences(userId, { security: { method: "pin", ...hashPin(pin), length: pin.length } });
    return OK;
  });
}
