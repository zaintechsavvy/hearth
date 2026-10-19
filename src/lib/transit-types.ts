/** One stop found by a search, with the routes that call there. */
export interface StopChoice {
  key: string;
  name: string;
  code: string | null;
  /** Metres from home, when found near it. */
  distance: number | null;
  routes: string[];
}

/** One bus or train leaving a stop, scheduled or, when the agency shares it, live. */
export interface Departure {
  id: string;
  stop: string;
  route: string;
  /** #rrggbb from the agency, when it has one. */
  color: string | null;
  headsign: string;
  /** When it leaves, in UTC. */
  at: string;
  /** True when the time comes from the agency's live feed rather than the timetable. */
  live: boolean;
  /** Seconds late, or early when negative, when live. */
  delay: number | null;
  canceled: boolean;
}
