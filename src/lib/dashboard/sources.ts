import { shownByDefault, type Device } from "@/lib/devices/types";
import { sceneTileId } from "@/lib/scenes/types";
import { cameraTileId, type TileSource } from "./layout";

interface SourceInput {
  devices: Device[];
  cameras: { id: string }[];
  scenes: { id: string }[];
  integrations: { id: string; curated: boolean }[];
}

export const hasLevel = (device: Device) =>
  (device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable) || (device.kind === "cover" && device.canSetPosition);

/**
 * Everything that can become a tile. New devices from a connection the person has already reviewed start hidden,
 * so a device added to Home Assistant later waits for review instead of appearing on the dashboard.
 */
export function tileSources({ devices, cameras, scenes, integrations }: SourceInput): TileSource[] {
  const curated = new Set(integrations.filter(item => item.curated).map(item => item.id));
  return [
    ...devices.map(device => ({ id: device.id, kind: device.kind, adjustable: hasLevel(device), hidden: curated.has(device.integrationId) || !shownByDefault(device) })),
    ...scenes.map(scene => ({ id: sceneTileId(scene.id), kind: "scene" as const })),
    ...cameras.map(camera => ({ id: cameraTileId(camera.id), kind: "camera" as const })),
  ];
}
