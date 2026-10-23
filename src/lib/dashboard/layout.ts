import { parseDeviceId, type Device } from "@/lib/devices/types";
import type { Cell, GridColumns } from "@/lib/dashboard/placement";

export const WIDGET_KINDS = ["weather", "calendar", "reminders", "clock", "bins", "medications", "countdown", "notes", "wifi", "timers", "plants", "packages", "energy", "people", "appliances", "announce", "departures", "activity"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];
/** `leak` is a leak sensor's own tile: a binary sensor, shown as dry or wet with an alarm. */
export type TileKind = Device["kind"] | WidgetKind | "leak";
export type TileSize = "1x1" | "2x1" | "1x2" | "2x2" | "2x3" | "2x4" | "3x3" | "4x1" | "4x2" | "4x3" | "4x4";

export const TILE_KINDS = [
  "light", "switch", "fan", "thermostat", "lock", "cover", "binary_sensor", "leak", "sensor", "camera", "event", "scene", "media_player",
  "person", "vacuum", "alarm", "todo", ...WIDGET_KINDS,
] as const satisfies readonly TileKind[];
export const TILE_SIZES = ["1x1", "2x1", "1x2", "2x2", "2x3", "2x4", "3x3", "4x1", "4x2", "4x3", "4x4"] as const satisfies readonly TileSize[];
export const TILE_COLORS = ["amber", "orange", "rose", "violet", "blue", "teal", "green", "graphite"] as const;
export type TileColor = (typeof TILE_COLORS)[number];

export const TILE_ICONS = [
  "lightbulb", "lamp", "lamp-desk", "lamp-floor", "lamp-ceiling", "sun", "moon", "sparkles", "star",
  "fan", "air-vent", "wind", "plug", "power", "zap", "tv", "monitor", "speaker", "music", "gamepad",
  "coffee", "cooking-pot", "refrigerator", "microwave", "washing-machine", "bed", "sofa", "armchair", "bath",
  "shower", "door", "lock", "blinds", "heater", "flame", "snowflake", "droplets", "leaf", "flower", "router",
  "car", "baby", "dog", "cat", "bell", "house", "lock-open", "door-closed", "garage", "activity", "thermometer",
  "battery", "gauge", "clapperboard", "play", "shield", "bell-ring", "camera", "calendar", "list-checks", "clock",
  "trash", "recycle", "pill", "hourglass", "sticky-note", "wifi", "timer", "sprout", "package",
  "user", "users", "circle-dot", "shopping-cart", "megaphone", "siren", "bus", "train",
] as const;
export type TileIcon = (typeof TILE_ICONS)[number];

export interface WeatherPlace {
  name: string;
  latitude: number;
  longitude: number;
}

export interface TileOptions {
  /** Weather: the place to forecast. */
  place?: WeatherPlace;
  /** Weather: units for temperatures. */
  units?: "C" | "F";
  /** Calendar: which saved calendars to show; all of them when absent. */
  calendars?: string[];
  /** Countdown and Wi-Fi: the one item this tile shows. */
  itemId?: string;
  /** Device tiles: leave the room or the status line off this tile. */
  hideRoom?: boolean;
  hideStatus?: boolean;
  /** Device tiles: fill with the tile's colour while on, instead of white. */
  glow?: boolean;
  /** What a press and hold does: a light's controls, a reading's history, a Hearth scene (`scene:<id>`), a scene from a connection (`device:<id>`), or nothing. */
  hold?: TileHold;
  /** Energy: price per kWh, for today's cost. */
  price?: number;
  /** Announcements: the speakers it last spoke on. */
  speakers?: string[];
  /** Timers: the user's own one-tap starts, shown before the plain lengths. */
  presets?: TimerPreset[];
  /** Departures: the stops whose next buses and trains it lists. */
  stops?: TransitStop[];
  /** Cameras: stream live, or show a fresh still every `every` seconds and go live only when tapped. */
  video?: "live" | "snapshots";
  every?: number;
}

export interface TransitStop {
  /** Transitland's key for the stop, such as `f-dpz8-ttc:1234` or a Onestop ID. */
  key: string;
  name: string;
}

export interface TimerPreset {
  label: string;
  minutes: number;
}

export type TileHold = "controls" | "history" | "none" | `scene:${string}` | `device:${string}`;

/** One tile someone put on their dashboard. */
export interface TileConfig {
  id: string;
  kind: TileKind;
  /** What the tile shows: a device id, `camera:<id>`, or `scene:<id>`. Null until linked; widgets never link. */
  link: string | null;
  size: TileSize;
  icon?: TileIcon;
  color?: TileColor;
  /** The tile's own name: for a tile not linked yet, or to call a linked device something else on this tile only. */
  label?: string;
  options?: TileOptions;
  /** The cell it was put in at each grid width; a tile with none for a width fills the first gap that fits it. */
  at?: Partial<Record<GridColumns, Cell>>;
}

/** Something a tile can link to: a device, a camera, or a scene. */
export interface TileSource {
  id: string;
  kind: TileKind;
  /** Lights, fans, and covers with a level get a slider template by default. */
  adjustable?: boolean;
  /** Not worth suggesting, such as battery levels and diagnostic buttons. */
  hidden?: boolean;
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
  cover: [...SWITCHABLE, { size: "1x2", label: "Tall" }, { size: "2x2", label: "Large" }],
  switch: SWITCHABLE,
  lock: [...SWITCHABLE, { size: "1x2", label: "Tall" }, { size: "2x2", label: "Large" }],
  binary_sensor: SWITCHABLE,
  leak: [{ size: "1x1", label: "Icon" }, { size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }],
  sensor: [...SWITCHABLE, { size: "2x2", label: "Chart" }, { size: "4x2", label: "Wide chart" }],
  person: SWITCHABLE,
  vacuum: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }],
  alarm: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Keypad" }],
  todo: [{ size: "2x2", label: "Short list" }, { size: "2x3", label: "List" }, { size: "2x4", label: "Tall" }],
  event: SWITCHABLE,
  scene: SWITCHABLE,
  thermostat: [{ size: "2x2", label: "Compact" }, { size: "3x3", label: "Large" }],
  camera: [{ size: "2x2", label: "Square" }, { size: "3x3", label: "Medium" }, { size: "4x2", label: "Wide" }, { size: "4x3", label: "Large" }, { size: "4x4", label: "Big" }],
  media_player: [{ size: "4x1", label: "Bar" }, { size: "4x2", label: "Player" }],
  weather: [{ size: "2x1", label: "Now" }, { size: "2x2", label: "Today" }, { size: "4x2", label: "Week" }],
  calendar: [{ size: "2x2", label: "Next up" }, { size: "2x3", label: "Agenda" }, { size: "2x4", label: "Tall" }, { size: "4x2", label: "Wide" }],
  reminders: [{ size: "2x2", label: "Short list" }, { size: "2x3", label: "List" }, { size: "2x4", label: "Tall" }],
  clock: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }],
  bins: [{ size: "2x1", label: "Card" }, { size: "4x1", label: "Wide" }, { size: "2x2", label: "Large" }],
  medications: [{ size: "2x2", label: "Today" }, { size: "2x3", label: "List" }, { size: "4x2", label: "Wide" }],
  countdown: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }],
  notes: [{ size: "2x2", label: "Small board" }, { size: "2x3", label: "Tall board" }, { size: "4x2", label: "Wide board" }, { size: "4x3", label: "Big board" }],
  wifi: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "With QR code" }],
  timers: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }, { size: "4x2", label: "Wide" }],
  plants: [{ size: "2x2", label: "Small" }, { size: "2x3", label: "Tall" }, { size: "4x2", label: "Wide" }],
  packages: [{ size: "2x2", label: "Small" }, { size: "2x3", label: "Tall" }, { size: "4x2", label: "Wide" }],
  energy: [{ size: "2x2", label: "Today" }, { size: "4x2", label: "With chart" }],
  people: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }, { size: "4x1", label: "Wide" }],
  activity: [{ size: "2x2", label: "Card" }, { size: "2x3", label: "Tall" }, { size: "4x2", label: "Wide" }],
  appliances: [{ size: "2x1", label: "Card" }, { size: "2x2", label: "Large" }, { size: "4x1", label: "Wide" }],
  announce: [{ size: "2x2", label: "Card" }, { size: "4x2", label: "Wide" }],
  departures: [{ size: "2x2", label: "Next few" }, { size: "2x3", label: "List" }, { size: "4x2", label: "Board" }],
};

/** Kinds whose tiles take an icon and a colour. */
const UNSTYLED = new Set<TileKind>(["thermostat", "camera", "media_player", "vacuum", "alarm", "todo", "leak"]);
export type StyledKind = Exclude<TileKind, "thermostat" | "camera" | "media_player" | "vacuum" | "alarm" | "todo" | "leak" | WidgetKind>;
export const isStyled = (kind: TileKind): kind is StyledKind => !UNSTYLED.has(kind) && !isWidget(kind);
export const isWidget = (kind: TileKind): kind is WidgetKind => (WIDGET_KINDS as readonly string[]).includes(kind);

const KIND_ORDER: TileKind[] = ["thermostat", "alarm", "media_player", "vacuum", "todo", "person", "scene", "light", "fan", "switch", "lock", "cover", "leak", "binary_sensor", "sensor", "event", "camera"];

export const cameraTileId = (cameraId: string) => `camera:${cameraId}`;

export function spanOf(size: TileSize) {
  const [columns, rows] = size.split("x").map(Number);
  return { columns, rows };
}

export function defaultSize(kind: TileKind, adjustable = false): TileSize {
  switch (kind) {
    case "thermostat":
      return "3x3";
    case "camera":
      return "4x3";
    case "lock":
    case "event":
    case "scene":
    case "weather":
    case "clock":
      return "2x1";
    case "calendar":
    case "reminders":
      return "2x3";
    case "bins":
    case "media_player":
      return "4x1";
    case "vacuum":
    case "alarm":
    case "people":
    case "appliances":
      return "2x1";
    case "todo":
      return "2x3";
    case "energy":
    case "announce":
      return "2x2";
    case "countdown":
    case "timers":
      return "2x1";
    case "wifi":
      return "2x1";
    case "departures":
    case "activity":
      return "2x2";
    case "medications":
    case "notes":
    case "plants":
    case "packages":
      return "2x2";
    case "cover":
      return adjustable ? "1x2" : "2x1";
    case "switch":
    case "sensor":
    case "binary_sensor":
      return "1x1";
    case "leak":
      return "2x1";
    default:
      return adjustable ? "1x2" : "1x1";
  }
}

export const newTileId = () => `tile-${crypto.randomUUID()}`;

export function createTile(kind: TileKind, link: string | null = null, adjustable = false, extra: Partial<TileConfig> = {}): TileConfig {
  return { id: newTileId(), kind, link, size: defaultSize(kind, adjustable), ...extra };
}

/** One page of the dashboard, such as Home, Kitchen, or Wall tablet. */
export interface DashboardPage {
  id: string;
  name: string;
  layout: SavedTile[];
}

export const HOME_PAGE_ID = "home";

/** A saved entry from before tiles had their own id and kind: `{ id: <device id>, size, hidden? }`. */
export interface LegacyTile {
  id: string;
  size: TileSize;
  icon?: TileIcon;
  color?: TileColor;
  hidden?: boolean;
  kind?: undefined;
}

/**
 * Turns what was saved into the tiles to draw. Tiles keep their order and settings, sizes their kind cannot use
 * fall back to its default, and entries in the older shape become linked tiles. Nothing is added: the dashboard
 * holds only what the person put there.
 */
export type SavedTile = TileConfig | LegacyTile;

/** On/off kinds a device can be shown as; a tile follows its device between them. */
const SHOWN_AS = new Set<TileKind>(["light", "switch", "fan"]);

export function resolveLayout(saved: SavedTile[], sources: TileSource[]): TileConfig[] {
  const byId = new Map(sources.map(source => [source.id, source]));
  const seen = new Set<string>();
  const tiles: TileConfig[] = [];
  for (const entry of saved) {
    if (seen.has(entry.id) || (entry.kind !== undefined && !SIZE_OPTIONS[entry.kind])) continue;
    seen.add(entry.id);
    let tile: TileConfig;
    if (entry.kind === undefined) {
      const source = byId.get(entry.id);
      if (!source || entry.hidden) continue;
      tile = { id: entry.id, kind: source.kind, link: entry.id, size: entry.size, icon: entry.icon, color: entry.color };
    } else {
      tile = entry;
      const source = entry.link ? byId.get(entry.link) : undefined;
      if (source && source.kind !== entry.kind && SHOWN_AS.has(source.kind) && SHOWN_AS.has(entry.kind)) tile = { ...entry, kind: source.kind };
    }
    const allowed = SIZE_OPTIONS[tile.kind].some(option => option.size === tile.size);
    tiles.push(allowed ? tile : { ...tile, size: defaultSize(tile.kind, byId.get(tile.link ?? "")?.adjustable) });
  }
  return tiles;
}

/** A starting dashboard from what is connected: the devices worth showing, thermostats first. */
export function suggestedTiles(sources: TileSource[]): TileConfig[] {
  return sources
    .filter(source => !source.hidden)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map((source, index, all) => {
      const firstThermostat = source.kind === "thermostat" && all.findIndex(item => item.kind === "thermostat") === index;
      const size = source.kind === "thermostat" && !firstThermostat ? "2x2" : defaultSize(source.kind, source.adjustable);
      return { id: newTileId(), kind: source.kind, link: source.id, size };
    });
}

/**
 * Drops saved tiles that point at a device of a connection that no longer exists, so removing a connection never
 * leaves "choose a device" tiles behind. RTSP camera, scene, and widget tiles are kept, and so are tiles of a
 * connection that is only offline.
 */
export function withoutOrphanTiles<T extends SavedTile>(saved: T[], integrationIds: ReadonlySet<string>): T[] {
  return saved.filter(entry => {
    const link = entry.kind === undefined ? entry.id : entry.link;
    if (!link || link.startsWith("camera:") || link.startsWith("scene:")) return true;
    const device = parseDeviceId(link);
    return !device || integrationIds.has(device.integrationId);
  });
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

export function removeTile(tiles: TileConfig[], id: string) {
  return tiles.filter(tile => tile.id !== id);
}
