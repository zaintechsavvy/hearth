import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { background } from "@/lib/db/schema";
import { getPreferences, readableError } from "@/lib/home";
import { albumPhotos } from "@/lib/photos";
import { getHome } from "@/lib/session";

/** The wall tablet's photo frame: photos uploaded to Hearth, or the household's Immich album. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (new URL(request.url).searchParams.get("source") === "immich") {
    const { photos } = await getPreferences(home.homeId);
    if (!photos) return NextResponse.json({ error: "Connect an Immich album first." }, { status: 409 });
    try {
      const album = await albumPhotos({ ...photos, key: unseal<string>(photos.key) });
      return NextResponse.json({ name: album.name, photos: album.photos.map(photo => ({ ...photo, src: `/api/photos/${photo.id}` })) });
    } catch (error) {
      return NextResponse.json({ error: readableError(error) }, { status: 502 });
    }
  }
  const rows = await db.select({ id: background.id, width: background.width, height: background.height }).from(background).where(eq(background.userId, home.homeId)).orderBy(desc(background.createdAt));
  return NextResponse.json({ name: "Your photos", photos: rows.map(row => ({ ...row, src: `/api/backgrounds/${row.id}` })) });
}
