import "server-only";
import { onHomeChange, startMonitor } from "./monitor";
import { recordReadings } from "./recorder";

/** Wires every job that rides on the home monitor, then starts it. */
export function startHomeMonitor() {
  onHomeChange(recordReadings);
  startMonitor();
}
