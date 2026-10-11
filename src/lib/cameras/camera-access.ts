import "server-only";
import { unseal } from "@/lib/crypto";
import { findCamera, streamRelayUrl } from "@/lib/home";
import { getUser } from "@/lib/session";
import { StreamRelay, relayStreamName, type CameraSource } from "./stream-relay";

/** Resolves a camera the signed-in user owns, with its relay and stream name. */
export async function cameraForRequest(cameraId: string) {
  const user = await getUser();
  if (!user) return null;
  const row = await findCamera(user.id, cameraId);
  if (!row) return null;
  return {
    relay: new StreamRelay(await streamRelayUrl(user.id)),
    stream: relayStreamName(row.id),
    source: unseal<CameraSource>(row.source),
  };
}
