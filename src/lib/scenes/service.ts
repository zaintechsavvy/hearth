import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TILE_ICONS } from "@/lib/dashboard/layout";
import { db } from "@/lib/db";
import { scene } from "@/lib/db/schema";
import { deviceCommandSchema } from "@/lib/devices/command-schema";
import { isSensitive } from "@/lib/devices/types";
import { loadHome } from "@/lib/home";

export const sceneInput = z.object({
  name: z.string().trim().min(1, "Give the scene a name.").max(60),
  icon: z.enum(TILE_ICONS).nullable().optional(),
  actions: z.array(z.object({ deviceId: z.string().min(1).max(300), command: deviceCommandSchema })).min(1, "Add at least one device.").max(100),
});

/** Validates and stores a scene. Scenes may lock and close, never unlock or open; that is checked against the real devices. */
export async function saveScene(userId: string, input: unknown, sceneId?: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = sceneInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That scene is not valid." };
  const devices = new Map((await loadHome(userId)).devices.map(device => [device.id, device]));
  for (const action of parsed.data.actions) {
    const device = devices.get(action.deviceId);
    if (!device) return { ok: false, error: "One of those devices is not connected." };
    if (isSensitive(device, action.command)) return { ok: false, error: `A scene cannot unlock or open ${device.name}.` };
  }
  const values = { name: parsed.data.name, icon: parsed.data.icon ?? null, actions: parsed.data.actions };
  if (sceneId) {
    await db.update(scene).set(values).where(and(eq(scene.id, sceneId), eq(scene.userId, userId)));
    return { ok: true, id: sceneId };
  }
  const [row] = await db.insert(scene).values({ userId, ...values }).returning({ id: scene.id });
  return { ok: true, id: row.id };
}
