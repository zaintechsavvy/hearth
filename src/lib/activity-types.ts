export const ACTIVITY_CATEGORIES = ["lights", "doors", "sensors", "climate", "household", "automations", "system"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface AlertSettings {
  doorbell: boolean;
  /** Leaks and smoke. */
  safety: boolean;
  /** Jammed locks. */
  locks: boolean;
  /** Minutes a door, gate, or garage may stay open before an alert; 0 never. */
  openMinutes: number;
  timers: boolean;
  medications: boolean;
}

export const DEFAULT_ALERTS: AlertSettings = { doorbell: true, safety: true, locks: true, openMinutes: 10, timers: true, medications: true };

export interface ActivityEntry {
  id: string;
  at: string;
  deviceId: string | null;
  name: string;
  room: string | null;
  what: string;
  category: ActivityCategory;
  tone: "info" | "warning" | "alert";
  by: string | null;
  /** Where a change made outside Hearth was made: "in Home Assistant", or "at the device". */
  via?: string | null;
  /** A doorbell ring's picture from its camera, when one was kept. */
  picture?: string;
  /** Every device in a line that tells of several changing together, such as two lights turned on as one. */
  deviceIds?: string[];
  /** The lines a "turned on and off 4 times" line stands for, newest first, shown when it is opened. */
  group?: ActivityEntry[];
}
