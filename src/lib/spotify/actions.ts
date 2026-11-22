"use server";

import { revalidatePath } from "next/cache";
import { authed, OK, type ActionResult } from "@/lib/action-helpers";
import { db } from "@/lib/db";
import { spotifyLink } from "@/lib/db/schema";
import { isClientId } from "./auth";
import { signOut, spotifyLinkOf } from "./client";

/** A new Client ID belongs to another Spotify app, so the sign in made with the old one goes. Empty falls back to SPOTIFY_CLIENT_ID. */
export async function saveSpotifyClientId(input: unknown): Promise<ActionResult> {
  const clientId = typeof input === "string" ? input.trim() : "";
  if (clientId && !isClientId(clientId)) return { ok: false, error: "A Client ID is 32 letters and numbers, from your app's page in the Spotify developer dashboard." };
  return authed(async homeId => {
    const row = await spotifyLinkOf(homeId);
    if ((row?.clientId ?? "") === clientId) return OK;
    const values = { clientId: clientId || null, accessToken: null, refreshToken: null, expiresAt: null, account: null };
    await db.insert(spotifyLink).values({ userId: homeId, ...values }).onConflictDoUpdate({ target: spotifyLink.userId, set: values });
    revalidatePath("/settings");
    return OK;
  }, "owner");
}

export async function disconnectSpotify(): Promise<ActionResult> {
  return authed(async homeId => {
    await signOut(homeId);
    revalidatePath("/settings");
    return OK;
  }, "owner");
}
