"use server";

import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { authed, firstIssue, OK, type ActionResult, type CreatedResult } from "@/lib/action-helpers";
import { seal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { widgetItem } from "@/lib/db/schema";
import { IntegrationError } from "@/lib/integrations/types";
import { ITEM_KINDS, ITEM_SCHEMAS, type ItemData, type ItemKind } from "@/lib/widgets/items";
import { timerRemaining } from "@/lib/widgets/schedules";

const TAKEN_KEEP_DAYS = 14;

async function owned<K extends ItemKind>(userId: string, id: string, kind: K) {
  const row = await db.query.widgetItem.findFirst({ where: and(eq(widgetItem.id, id), eq(widgetItem.userId, userId)) });
  if (!row || row.kind !== kind) throw new IntegrationError("That item is gone. Reload the page.");
  return row.data as ItemData<K>;
}

async function write(userId: string, id: string, data: Record<string, unknown>) {
  await db.update(widgetItem).set({ data }).where(and(eq(widgetItem.id, id), eq(widgetItem.userId, userId)));
}

/** Adds or edits one widget item after checking it against its kind's schema. Wi-Fi passwords are sealed. */
export async function saveWidgetItem(kind: unknown, input: unknown, id?: string): Promise<CreatedResult> {
  const parsedKind = z.enum(ITEM_KINDS as [ItemKind, ...ItemKind[]]).safeParse(kind);
  if (!parsedKind.success) return { ok: false, error: "That widget is not known." };
  const parsed = ITEM_SCHEMAS[parsedKind.data].safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsedKind.data === "wifi") data.password = data.password ? seal(data.password) : "";
  let saved = id ?? "";
  const result = await authed(async userId => {
    if (id) {
      await owned(userId, id, parsedKind.data);
      await write(userId, id, data);
      return OK;
    }
    const [{ last }] = await db.select({ last: max(widgetItem.position) }).from(widgetItem).where(and(eq(widgetItem.userId, userId), eq(widgetItem.kind, parsedKind.data)));
    const [row] = await db.insert(widgetItem).values({ userId, kind: parsedKind.data, data, position: (last ?? -1) + 1 }).returning({ id: widgetItem.id });
    saved = row.id;
    return OK;
  });
  return result.ok ? { ok: true, id: saved } : result;
}

export async function deleteWidgetItem(id: string): Promise<ActionResult> {
  return authed(async userId => {
    await db.delete(widgetItem).where(and(eq(widgetItem.id, id), eq(widgetItem.userId, userId)));
    return OK;
  });
}

/** Marks a scheduled dose taken or not, counting the supply down or back up and forgetting doses older than two weeks. */
export async function setDoseTaken(id: string, slot: string, taken: boolean): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(slot)) return { ok: false, error: "That dose is not valid." };
  return authed(async userId => {
    const medication = await owned(userId, id, "medication");
    const cutoff = new Date(Date.now() - TAKEN_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    const record = Object.fromEntries(Object.entries(medication.taken).filter(([key]) => key.slice(0, 10) >= cutoff && key !== slot));
    const was = Boolean(medication.taken[slot]);
    if (taken) record[slot] = new Date().toISOString();
    const supply = medication.supply === null || was === taken ? medication.supply : Math.max(0, medication.supply + (taken ? -1 : 1));
    await write(userId, id, { ...medication, taken: record, supply });
    return OK;
  });
}

export async function waterPlant(id: string): Promise<ActionResult> {
  return authed(async userId => {
    const plant = await owned(userId, id, "plant");
    await write(userId, id, { ...plant, lastWatered: new Date().toISOString() });
    return OK;
  });
}

const timerControl = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("add"), ms: z.number().int().min(-3_600_000).max(3_600_000) }),
]);

/** Timers live on the server, so every screen counts down together and one that rings rings everywhere. */
export async function controlTimer(id: string, control: unknown): Promise<ActionResult> {
  const parsed = timerControl.safeParse(control);
  if (!parsed.success) return { ok: false, error: "That timer action is not valid." };
  return authed(async userId => {
    const timer = await owned(userId, id, "timer");
    const now = Date.now();
    const left = timerRemaining(timer, now);
    const next = { ...timer };
    switch (parsed.data.action) {
      case "start":
        next.endsAt = new Date(now + (left > 0 ? left : timer.durationMs)).toISOString();
        break;
      case "pause":
        next.endsAt = null;
        next.remainingMs = left;
        break;
      case "reset":
        next.endsAt = null;
        next.remainingMs = timer.durationMs;
        break;
      case "add": {
        const remaining = Math.max(1000, left + parsed.data.ms);
        if (timer.endsAt) next.endsAt = new Date(now + remaining).toISOString();
        else next.remainingMs = remaining;
        break;
      }
    }
    await write(userId, id, next);
    return OK;
  });
}

/** Clears every note the board has, or only the ones a person marks done. */
export async function clearNotes(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(z.string().max(100)).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Those notes are not valid." };
  return authed(async userId => {
    for (const id of parsed.data) await db.delete(widgetItem).where(and(eq(widgetItem.id, id), eq(widgetItem.userId, userId), eq(widgetItem.kind, "note")));
    return OK;
  });
}
