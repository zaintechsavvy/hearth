export const ACTIVITY_CATEGORIES = ["lights", "doors", "sensors", "climate", "household", "system"] as const;
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
}
