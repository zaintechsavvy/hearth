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
}

export const WALL_KEY = "hearth-wall";

export const DEFAULT_WALL: WallSettings = {
  enabled: false, idleMinutes: 5, dimFrom: "22:00", dimTo: "07:00", dimLevel: 0.55, wakeSensors: [], keepAwake: true, showAssistant: true,
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
