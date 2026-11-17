import type { CameraDevice, Device } from "@/lib/devices/types";

/** The camera chosen for a doorbell in Customize, while it can stream; a doorbell with none chosen has no camera. */
export function cameraFor(doorbell: Device, devices: Device[]): CameraDevice | null {
  if (doorbell.kind !== "event" || !doorbell.camera) return null;
  return devices.find((device): device is CameraDevice => device.id === doorbell.camera && device.kind === "camera" && device.available && device.streamable) ?? null;
}
