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
  showAssistant: boolean;
  /** The resting clock's colour and how bright it shows, 0.15 to 1. */
  clockColor: ClockColor;
  clockBrightness: number;
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

export const WALL_KEY = "hearth-wall";

export const DEFAULT_WALL: WallSettings = {
  enabled: false, idleMinutes: 5, dimFrom: "22:00", dimTo: "07:00", dimLevel: 0.55, wakeSensors: [], keepAwake: true, showAssistant: true,
  clockColor: "white", clockBrightness: 0.85, nightRed: true, openReminder: true, openMinutes: 15,
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
