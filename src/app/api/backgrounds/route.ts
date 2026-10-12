import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { background } from "@/lib/db/schema";
import { getHome } from "@/lib/session";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 24;
const TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const MAX_SIDE = 4096;

export async function GET() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const rows = await db.select({ id: background.id, width: background.width, height: background.height, createdAt: background.createdAt })
    .from(background).where(eq(background.userId, home.homeId)).orderBy(desc(background.createdAt));
  return NextResponse.json(rows);
}

/** Takes one image the browser has already resized, as the raw request body. */
export async function POST(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot see this." }, { status: 403 });
  const mime = request.headers.get("content-type")?.split(";")[0] as (typeof TYPES)[number];
  if (!TYPES.includes(mime)) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  const width = Number(request.headers.get("x-image-width")), height = Number(request.headers.get("x-image-height"));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) {
    return NextResponse.json({ error: "Send the image's size." }, { status: 400 });
  }
  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) return NextResponse.json({ error: "That image is too large. Try one under 20 MB." }, { status: 413 });
  const count = (await db.select({ id: background.id }).from(background).where(eq(background.userId, home.homeId))).length;
  if (count >= MAX_PHOTOS) return NextResponse.json({ error: `You can keep up to ${MAX_PHOTOS} photos. Remove one first.` }, { status: 409 });
  const [row] = await db.insert(background).values({ userId: home.homeId, mime, data, width, height }).returning({ id: background.id });
  return NextResponse.json({ id: row.id, width, height });
}
