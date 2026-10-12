import "server-only";
import { unseal } from "@/lib/crypto";
import { findCamera, streamRelayUrl } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";
import { StreamRelay, relayStreamName, type CameraSource } from "./stream-relay";

/** Resolves a camera in the signed-in person's home, with its relay and stream name. Guests only reach cameras on their pages. */
export async function cameraForRequest(cameraId: string) {
  const home = await getHome();
  if (!home || !(await guestCanReach(home, `camera:${cameraId}`))) return null;
  const row = await findCamera(home.homeId, cameraId);
  if (!row) return null;
  return {
    relay: new StreamRelay(await streamRelayUrl(home.homeId)),
    stream: relayStreamName(row.id),
    source: unseal<CameraSource>(row.source),
  };
}
