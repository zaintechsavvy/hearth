"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { preference } from "@/lib/db/schema";
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

export async function loadBackground(): Promise<SyncedBackground | null> {
  const home = await getHome();
  if (!home) return null;
  const row = await db.query.preference.findFirst({ where: eq(preference.userId, home.user.id), columns: { background: true } });
  return row?.background ?? null;
}
