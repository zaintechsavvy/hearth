import type { Cell } from "./placement";
import { newTileId, type TileConfig, type TileSize, type TileSource } from "./layout";

export interface CameraLayout {
  id: "focus" | "pair" | "grid" | "single";
  name: string;
  /** Where each camera goes on the widest grid, eight columns across; more cameras than slots follow as squares. */
  slots: { size: TileSize; at: Cell }[];
}

export const CAMERA_LAYOUTS: CameraLayout[] = [
  { id: "focus", name: "One large, two beside", slots: [{ size: "4x4", at: { column: 0, row: 0 } }, { size: "4x2", at: { column: 4, row: 0 } }, { size: "4x2", at: { column: 4, row: 2 } }] },
  { id: "pair", name: "Two side by side", slots: [{ size: "4x3", at: { column: 0, row: 0 } }, { size: "4x3", at: { column: 4, row: 0 } }] },
  { id: "grid", name: "Grid of four", slots: [{ size: "4x2", at: { column: 0, row: 0 } }, { size: "4x2", at: { column: 4, row: 0 } }, { size: "4x2", at: { column: 0, row: 2 } }, { size: "4x2", at: { column: 4, row: 2 } }] },
  { id: "single", name: "One large", slots: [{ size: "4x4", at: { column: 2, row: 0 } }] },
];

/** The tiles of a camera page: each camera in the layout's next slot, and any left over as squares after them. */
export function cameraPageTiles(layout: CameraLayout, sources: TileSource[]): TileConfig[] {
  return sources.filter(source => source.kind === "camera").map((source, index) => {
    const slot = layout.slots[index];
    return { id: newTileId(), kind: "camera", link: source.id, size: slot?.size ?? "2x2", ...(slot ? { at: { 8: slot.at } } : {}) };
  });
}

/** The layout's tiles added to a page under what is already on it, `below` rows down on the widest grid. */
export function cameraLayoutTiles(layout: CameraLayout, sources: TileSource[], below: number): TileConfig[] {
  return cameraPageTiles(layout, sources).map(tile => tile.at?.[8] ? { ...tile, at: { 8: { ...tile.at[8], row: tile.at[8].row + below } } } : tile);
}
