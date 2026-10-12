import "server-only";
import { logActivity, onLoggedChanges } from "./activity";
import { alertOnChanges, alertOnTick } from "./alerts";
import { runDeviceAutomations, runTimedAutomations } from "./automations";
import { onHomeChange, onTick, startMonitor } from "./monitor";
import { recordReadings } from "./recorder";

/** Wires every job that rides on the home monitor, then starts it. */
export function startHomeMonitor() {
  onHomeChange(recordReadings);
  onHomeChange(logActivity);
  onLoggedChanges(alertOnChanges);
  onTick(alertOnTick);
  onHomeChange(runDeviceAutomations);
  onTick(runTimedAutomations);
  startMonitor();
}
