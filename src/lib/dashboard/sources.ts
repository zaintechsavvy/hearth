import { shownByDefault, type Device } from "@/lib/devices/types";
import { sceneTileId } from "@/lib/scenes/types";
import { cameraTileId, type TileSource } from "./layout";

interface SourceInput {
  devices: Device[];
  cameras: { id: string }[];
  scenes: { id: string }[];
}

export const hasLevel = (device: Device) =>
  (device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable) || (device.kind === "cover" && device.canSetPosition);

/** Everything a tile can link to. `hidden` marks what is not worth suggesting, such as diagnostics and batteries. */
export function tileSources({ devices, cameras, scenes }: SourceInput): TileSource[] {
  return [
    ...devices.map(device => ({ id: device.id, kind: device.kind === "binary_sensor" && device.sensorClass === "leak" ? "leak" as const : device.kind, adjustable: hasLevel(device), hidden: !shownByDefault(device) })),
    ...scenes.map(scene => ({ id: sceneTileId(scene.id), kind: "scene" as const })),
    ...cameras.map(camera => ({ id: cameraTileId(camera.id), kind: "camera" as const })),
  ];
}
