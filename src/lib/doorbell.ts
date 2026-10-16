import "server-only";
import { and, eq, gte, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { ringPicture } from "@/lib/db/schema";
import { deviceProvider, loadHome } from "@/lib/home";
import { cameraFor } from "@/lib/ring-camera";

const KEEP_DAYS = 30;
/** Bigger pictures are skipped rather than stored. */
const MAX_BYTES = 1_500_000;
/** A ring and its picture count as one when this close together. */
export const RING_MATCH_MS = 3 * 60_000;
/** Keeps a picture from the doorbell's camera at the moment it rang. Every open screen may ask; the first one is kept. */
export async function captureRing(userId: string, doorbellId: string, at: Date) {
  const existing = await db.query.ringPicture.findFirst({
    where: and(eq(ringPicture.userId, userId), eq(ringPicture.deviceId, doorbellId), gte(ringPicture.at, new Date(at.getTime() - RING_MATCH_MS)), lte(ringPicture.at, new Date(at.getTime() + RING_MATCH_MS))),
    columns: { id: true },
  });
  if (existing) return;
  const home = await loadHome(userId);
  const doorbell = home.devices.find(device => device.id === doorbellId);
  if (!doorbell || doorbell.kind !== "event" || doorbell.eventClass !== "doorbell") return;
  const camera = cameraFor(doorbell, home.devices);
  if (!camera) return;
  const target = await deviceProvider(userId, camera.id);
  if (!target?.provider.camera) return;
  const response = await target.provider.camera(target.nativeId, "snapshot", AbortSignal.timeout(10_000));
  if (!response.ok) return;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return;
  await db.insert(ringPicture).values({ userId, deviceId: doorbellId, at, cameraName: camera.name, contentType: response.headers.get("content-type") ?? "image/jpeg", image: bytes.toString("base64") })
    .onConflictDoNothing();
  await db.delete(ringPicture).where(and(eq(ringPicture.userId, userId), lt(ringPicture.at, new Date(Date.now() - KEEP_DAYS * 86_400_000))));
}

/** The pictures kept between two times, without their bytes, to match against Activity's rings. */
export function ringPicturesBetween(userId: string, from: Date, to: Date) {
  return db.select({ id: ringPicture.id, deviceId: ringPicture.deviceId, at: ringPicture.at }).from(ringPicture)
    .where(and(eq(ringPicture.userId, userId), gte(ringPicture.at, new Date(from.getTime() - RING_MATCH_MS)), lt(ringPicture.at, new Date(to.getTime() + RING_MATCH_MS))));
}

export async function readRingPicture(userId: string, id: string) {
  return db.query.ringPicture.findFirst({ where: and(eq(ringPicture.id, id), eq(ringPicture.userId, userId)) });
}
