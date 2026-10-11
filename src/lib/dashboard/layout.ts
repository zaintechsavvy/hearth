import type { Device } from "@/lib/devices/types";

export type TileKind = Device["kind"] | "camera";
export type TileSize = "1x1" | "2x1" | "1x2" | "2x2" | "3x3" | "4x2" | "4x3";

export const TILE_SIZES = ["1x1", "2x1", "1x2", "2x2", "3x3", "4x2", "4x3"] as const satisfies readonly TileSize[];
export const TILE_COLORS = ["amber", "orange", "rose", "violet", "blue", "teal", "green", "graphite"] as const;
export type TileColor = (typeof TILE_COLORS)[number];

export const TILE_ICONS = [
  "lightbulb", "lamp", "lamp-desk", "lamp-floor", "lamp-ceiling", "sun", "moon", "sparkles", "star",
  "fan", "air-vent", "wind", "plug", "power", "zap", "tv", "monitor", "speaker", "music", "gamepad",
  "coffee", "cooking-pot", "refrigerator", "microwave", "washing-machine", "bed", "sofa", "armchair", "bath",
  "shower", "door", "lock", "blinds", "heater", "flame", "snowflake", "droplets", "leaf", "flower", "router",
  "car", "baby", "dog", "cat", "bell", "house",
] as const;
export type TileIcon = (typeof TILE_ICONS)[number];

export interface TileConfig {
  /** A device id, or `camera:<id>`. */
  id: string;
  size: TileSize;
  icon?: TileIcon;
  color?: TileColor;
  hidden?: boolean;
}

export interface TileSource {
  id: string;
  kind: TileKind;
  /** Lights and fans with a level get a slider template by default. */
  adjustable?: boolean;
}

export interface SizeOption {
  size: TileSize;
  label: string;
}

const SWITCHABLE: SizeOption[] = [
  { size: "1x1", label: "Icon" },
  { size: "2x1", label: "Card" },
];
const LEVELLED: SizeOption[] = [...SWITCHABLE, { size: "1x2", label: "Slider" }, { size: "2x2", label: "Large" }];

export const SIZE_OPTIONS: Record<TileKind, SizeOption[]> = {
  light: LEVELLED,
  fan: LEVELLED,
  switch: SWITCHABLE,
  thermostat: [{ size: "2x2", label: "Compact" }, { size: "3x3", label: "Large" }],
  camera: [{ size: "2x2", label: "Square" }, { size: "4x2", label: "Wide" }, { size: "4x3", label: "Large" }],
};

export const DEFAULT_ICON: Record<"light" | "fan" | "switch", TileIcon> = { light: "lightbulb", fan: "fan", switch: "plug" };
export const DEFAULT_COLOR: Record<"light" | "fan" | "switch", TileColor> = { light: "amber", fan: "teal", switch: "green" };

const KIND_ORDER: TileKind[] = ["thermostat", "light", "fan", "switch", "camera"];

export const cameraTileId = (cameraId: string) => `camera:${cameraId}`;

export function spanOf(size: TileSize) {
  const [columns, rows] = size.split("x").map(Number);
  return { columns, rows };
}

export function defaultSize(source: TileSource, isFirstOfKind: boolean): TileSize {
  switch (source.kind) {
    case "thermostat":
      return isFirstOfKind ? "3x3" : "2x2";
    case "camera":
      return "4x3";
    case "switch":
      return "1x1";
    default:
      return source.adjustable ? "1x2" : "1x1";
  }
}

/**
 * Reconciles a saved layout with what exists now: saved tiles keep their order and settings, tiles whose
 * source disappeared are dropped, sizes the kind no longer allows fall back to the default, and new sources
 * are appended by kind.
 */
export function resolveLayout(saved: TileConfig[], sources: TileSource[]): TileConfig[] {
  const byId = new Map(sources.map(source => [source.id, source]));
  const placed = new Set<string>();
  const seenKinds = new Set<TileKind>();
  const fallback = (source: TileSource) => {
    const size = defaultSize(source, !seenKinds.has(source.kind));
    seenKinds.add(source.kind);
    return size;
  };

  const kept: TileConfig[] = [];
  for (const tile of saved) {
    const source = byId.get(tile.id);
    if (!source || placed.has(tile.id)) continue;
    placed.add(tile.id);
    const allowed = SIZE_OPTIONS[source.kind].some(option => option.size === tile.size);
    if (allowed) seenKinds.add(source.kind);
    kept.push({ ...tile, size: allowed ? tile.size : fallback(source) });
  }

  const added = sources
    .filter(source => !placed.has(source.id))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map(source => ({ id: source.id, size: fallback(source) }));

  return [...kept, ...added];
}

export function moveTile(tiles: TileConfig[], fromId: string, toId: string) {
  const from = tiles.findIndex(tile => tile.id === fromId);
  const to = tiles.findIndex(tile => tile.id === toId);
  if (from < 0 || to < 0 || from === to) return tiles;
  const next = [...tiles];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function updateTile(tiles: TileConfig[], id: string, patch: Partial<Omit<TileConfig, "id">>) {
  return tiles.map(tile => tile.id === id ? { ...tile, ...patch } : tile);
}
