import "server-only";
import { logActivity, onLoggedChanges } from "./activity";
import { captureRing } from "@/lib/doorbell";
import { alertOnChanges, alertOnTick } from "./alerts";
import { runDeviceAutomations, runTimedAutomations } from "./automations";
import { onHomeChange, onTick, startMonitor } from "./monitor";
import { recordReadings } from "./recorder";

/** Wires every job that rides on the home monitor, then starts it. */
export function startHomeMonitor() {
  onHomeChange(recordReadings);
  onHomeChange(logActivity);
  onLoggedChanges(alertOnChanges);
  onLoggedChanges((userId, changes, at) => Promise.all(changes
    .filter(({ device, what }) => device.kind === "event" && device.eventClass === "doorbell" && what === "rang")
    .map(({ device }) => captureRing(userId, device.id, device.kind === "event" && device.last ? new Date(device.last) : at).catch(error => console.error(error)))));
  onTick(alertOnTick);
  onHomeChange(runDeviceAutomations);
  onTick(runTimedAutomations);
  startMonitor();
}
