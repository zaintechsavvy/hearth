import { after, NextResponse } from "next/server";
import { z } from "zod";
import { captureRing, readRingPicture } from "@/lib/doorbell";
import { getHome } from "@/lib/session";

const ringInput = z.object({ deviceId: z.string().min(1).max(300), at: z.iso.datetime({ offset: true }) });
/** A screen reporting a ring this long after it happened is too late for the picture to show it. */
const FRESH_MS = 2 * 60_000;

/** An open screen saw the doorbell ring: keep a picture from its camera, once, however many screens ask. */
export async function POST(request: Request) {
  const home = await getHome();
  if (!home || home.role === "guest") return new Response(null, { status: 403 });
  const parsed = ringInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the doorbell and when it rang." }, { status: 400 });
  const at = new Date(parsed.data.at);
  if (Math.abs(Date.now() - at.getTime()) > FRESH_MS) return new Response(null, { status: 204 });
  after(() => captureRing(home.homeId, parsed.data.deviceId, at).catch(error => console.error(error)));
  return new Response(null, { status: 202 });
}

/** One kept picture. */
export async function GET(request: Request) {
  const home = await getHome();
  const id = new URL(request.url).searchParams.get("id");
  if (!home || home.role === "guest" || !id) return new Response(null, { status: 404 });
  const picture = await readRingPicture(home.homeId, id);
  if (!picture) return new Response(null, { status: 404 });
  return new Response(Buffer.from(picture.image, "base64"), { headers: { "Content-Type": picture.contentType, "Cache-Control": "private, max-age=86400, immutable" } });
}
