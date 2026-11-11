/** How this screen behaves as a wall tablet. Kept on the device, since each tablet hangs somewhere different. */
export interface WallSettings {
  enabled: boolean;
  /** Minutes without a touch before the screensaver; 0 never. */
  idleMinutes: number;
  /** When the night dim starts and ends, as HH:MM. */
  dimFrom: string;
  dimTo: string;
  /** How dark the night dim gets, 0 to 0.85. */
  dimLevel: number;
  /** Motion, presence, or door sensors that wake the screen. */
  wakeSensors: string[];
  keepAwake: boolean;
  /** The resting clock's colour and how bright it shows, 0.15 to 1. `custom` uses `customColor`. */
  clockColor: ClockColor | "custom";
  /** A colour of the person's own, as `#rrggbb`. */
  customColor: string;
  clockBrightness: number;
  /** Rest on large digits, an analog face filled with the clock colour, or a luxury watch dial. */
  clockFace: ClockFace;
  /** The hour and minute hands' colour as `#rrggbb`, or null for the face's own. */
  handColor: string | null;
  /** The seconds hand ticks once a second, sweeps smoothly, or is left off. */
  secondHand: "tick" | "smooth" | "off";
  /** The digital clock: hours and minutes side by side or stacked, and its size (0.7 to 1.3). */
  digitLayout: "inline" | "stacked";
  digitScale: number;
  /** Turn the resting clock a dim red in the night window, instead of the chosen colour. */
  nightRed: boolean;
  /** After dark, point out a door, window, or garage door open for longer than `openMinutes`. */
  openReminder: boolean;
  openMinutes: number;
  /** Rest on a photo frame instead of a plain clock: photos uploaded to Hearth, or an Immich album. */
  frame: boolean;
  frameSource: PhotoSource;
  /** Seconds each photo shows, 10 to 120. */
  frameSeconds: number;
  /** Keep showing photos in the night window; otherwise the screen rests on the clock alone. */
  frameAtNight: boolean;
  /** Where the date, clock, and weather sit over photos: the lower left corner, or the middle. */
  frameClock: "corner" | "center";
}

export type PhotoSource = "uploads" | "immich";

export const CLOCK_COLORS = {
  white: "oklch(96% 0 0)",
  warm: "oklch(90% 0.05 75)",
  amber: "oklch(80% 0.14 72)",
  red: "oklch(64% 0.17 25)",
  green: "oklch(80% 0.13 150)",
  blue: "oklch(78% 0.1 240)",
  violet: "oklch(76% 0.12 300)",
} as const;
export type ClockColor = keyof typeof CLOCK_COLORS;
export type ClockFace = "digital" | "analog" | "luxury";

/** The analog face's fill for each clock colour: soft enough to sit on a wall all day, dark numerals on top. */
export const FACE_COLORS: Record<ClockColor, string> = {
  white: "oklch(93% 0.004 250)",
  warm: "oklch(90% 0.045 75)",
  amber: "oklch(85% 0.12 78)",
  red: "oklch(80% 0.09 25)",
  green: "oklch(86% 0.09 155)",
  blue: "oklch(84% 0.09 225)",
  violet: "oklch(83% 0.08 300)",
};

/** The luxury dial's colour for each clock colour: sunburst metal tones, from silver to a deep green. */
export const DIAL_COLORS: Record<ClockColor, string> = {
  white: "oklch(88% 0.006 250)",
  warm: "oklch(80% 0.05 80)",
  amber: "oklch(62% 0.11 75)",
  red: "oklch(34% 0.11 20)",
  green: "oklch(36% 0.08 160)",
  blue: "oklch(36% 0.1 255)",
  violet: "oklch(32% 0.09 300)",
};

type Palette = Record<ClockColor, string>;
const pick = (settings: Pick<WallSettings, "clockColor" | "customColor">, palette: Palette) =>
  settings.clockColor === "custom" ? settings.customColor : palette[settings.clockColor] ?? palette.white;

/** The digital clock's colour. */
export const clockColorOf = (settings: Pick<WallSettings, "clockColor" | "customColor">) => pick(settings, CLOCK_COLORS);
/** The analog face's fill. */
export const faceColorOf = (settings: Pick<WallSettings, "clockColor" | "customColor">) => pick(settings, FACE_COLORS);
/** The luxury dial's base colour. */
export const dialColorOf = (settings: Pick<WallSettings, "clockColor" | "customColor">) => pick(settings, DIAL_COLORS);

/** Whether text on `color` should be dark: true for light colours. Takes `#rrggbb` or `oklch(L% …)`. */
export function isLight(color: string) {
  const lightness = color.match(/^oklch\((\d+(?:\.\d+)?)%/);
  if (lightness) return Number(lightness[1]) > 62;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (!hex) return true;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3;
}

export const WALL_KEY = "hearth-wall";

export const DEFAULT_WALL: WallSettings = {
  enabled: false, idleMinutes: 5, dimFrom: "22:00", dimTo: "07:00", dimLevel: 0.55, wakeSensors: [], keepAwake: true,
  clockColor: "white", customColor: "#7aa7ff", clockBrightness: 0.85, clockFace: "digital", handColor: null, secondHand: "tick", digitLayout: "inline", digitScale: 1, nightRed: false, openReminder: true, openMinutes: 15,
  frame: false, frameSource: "uploads", frameSeconds: 20, frameAtNight: false, frameClock: "corner",
};

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

/** Whether `now` falls in the dim window, which may run past midnight. */
export function isNight(settings: Pick<WallSettings, "dimFrom" | "dimTo">, now: Date) {
  const current = now.getHours() * 60 + now.getMinutes();
  const from = minutes(settings.dimFrom), to = minutes(settings.dimTo);
  return from === to ? false : from < to ? current >= from && current < to : current >= from || current < to;
}
