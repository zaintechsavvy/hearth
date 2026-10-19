import type { CameraDevice, Device } from "@/lib/devices/types";

const WORDS_IGNORED = new Set(["camera", "cam", "doorbell", "bell", "video", "the"]);

const words = (text: string) => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !WORDS_IGNORED.has(word)));
const native = (device: Device) => device.id.slice(device.id.indexOf(":") + 1).replace(/^[a-z_]+\./, "");

/** The doorbell's camera: the one chosen for it, or else the one most likely to look at it, in the same room, sharing a word in its name, or a shared id. */
export function cameraFor(doorbell: Device, devices: Device[]): CameraDevice | null {
  const cameras = devices.filter((device): device is CameraDevice => device.kind === "camera" && device.available && device.streamable);
  const chosen = doorbell.kind === "event" && doorbell.camera ? cameras.find(camera => camera.id === doorbell.camera) : undefined;
  if (chosen) return chosen;
  if (cameras.length <= 1) return cameras[0] ?? null;
  const mine = words(doorbell.name);
  const id = native(doorbell);
  const score = (camera: CameraDevice) => {
    let points = camera.integrationId === doorbell.integrationId ? 1 : 0;
    if (doorbell.room && camera.room === doorbell.room) points += 3;
    if ([...words(camera.name)].some(word => mine.has(word))) points += 2;
    const other = native(camera);
    let shared = 0;
    while (shared < Math.min(id.length, other.length) && id[shared] === other[shared]) shared++;
    if (shared >= 5) points += 3;
    return points;
  };
  const best = [...cameras].sort((a, b) => score(b) - score(a))[0];
  return score(best) > 1 ? best : null;
}
