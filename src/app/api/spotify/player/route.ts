import { z } from "zod";
import { readableError } from "@/lib/home";
import { control, playback } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

/** What the home's Spotify plays now, read straight from Spotify, so the player keeps up with a skip at once. */
export async function GET() {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  try {
    return Response.json(await playback(home.homeId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}

const controlInput = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["play", "pause", "next", "previous"]) }),
  z.object({ action: z.literal("seek"), position: z.number().min(0).max(86_400) }),
  z.object({ action: z.literal("volume"), value: z.number().min(0).max(100) }),
  z.object({ action: z.literal("shuffle"), on: z.boolean() }),
  z.object({ action: z.literal("repeat"), mode: z.enum(["off", "all", "one"]) }),
  z.object({ action: z.literal("skip"), count: z.number().int().min(1).max(20) }),
]);

/** Controls the home's Spotify wherever it plays. */
export async function POST(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const parsed = controlInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  try {
    await control(home.homeId, parsed.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
