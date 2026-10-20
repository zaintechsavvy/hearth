"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { preference } from "@/lib/db/schema";
import { ownerOnly } from "@/lib/action-helpers";
import { getHome } from "@/lib/session";
import { MAX_GRADIENT_COLORS, WALLPAPERS, type SyncedBackground } from "@/lib/theme";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const unit = z.number().min(0).max(1);
const gradient = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(60),
  colors: z.array(hex).min(1).max(MAX_GRADIENT_COLORS),
  style: z.enum(["smooth", "flowing"]).optional(),
  motion: unit,
  swirl: unit,
  distortion: unit,
  grain: z.boolean(),
  dimAtNight: z.boolean(),
  night: z.array(hex).max(MAX_GRADIENT_COLORS).optional(),
});
const backgroundInput = z.object({
  wallpaper: z.enum(WALLPAPERS),
  gradient: gradient.nullable(),
  gradients: z.array(gradient).max(50),
  photo: z.object({ id: z.string().regex(/^[\w-]{1,100}$/), blur: z.number().min(0).max(24), dim: z.number().min(0).max(0.7) }).nullable(),
});

/** Saves the background for every device this person signs in on. Guests have one too: it is theirs, not the home's. */
export async function saveBackground(input: unknown): Promise<{ ok: true; savedAt: number } | { ok: false; error: string }> {
  const parsed = backgroundInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That background is not valid." };
  const home = await getHome();
  if (!home) return { ok: false, error: "Your session ended. Sign in again." };
  const background: SyncedBackground = { ...parsed.data, savedAt: Date.now() };
  await db.insert(preference).values({ userId: home.user.id, background }).onConflictDoUpdate({ target: preference.userId, set: { background } });
  return { ok: true, savedAt: background.savedAt };
}

/**
 * This person's background, or the owner's when they share theirs and set it more recently, so a change the owner
 * makes reaches everyone while anyone can still pick their own.
 */
export async function loadBackground(): Promise<SyncedBackground | null> {
  const home = await getHome();
  if (!home) return null;
  const [own, owner] = await Promise.all([
    db.query.preference.findFirst({ where: eq(preference.userId, home.user.id), columns: { background: true } }),
    home.homeId === home.user.id ? null : db.query.preference.findFirst({ where: eq(preference.userId, home.homeId), columns: { background: true, shareBackground: true } }),
  ]);
  const mine = own?.background ?? null, shared = owner?.shareBackground ? owner.background : null;
  return shared && (!mine || shared.savedAt > mine.savedAt) ? shared : mine;
}

export async function setShareBackground(share: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const home = await getHome();
  if (!home) return { ok: false, error: "Your session ended. Sign in again." };
  await db.insert(preference).values({ userId: home.homeId, shareBackground: share === true }).onConflictDoUpdate({ target: preference.userId, set: { shareBackground: share === true } });
  revalidatePath("/", "layout");
  return { ok: true };
}
