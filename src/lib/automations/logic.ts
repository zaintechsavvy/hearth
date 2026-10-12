import type { Device } from "@/lib/devices/types";
import { hsToHex } from "@/lib/devices/color";
import type { DeviceCommand } from "@/lib/devices/types";
import { isNight } from "@/lib/wall";
import { sunTimes } from "./sun";
import type { Action, Condition, HomeLocation, StateMatch, Trigger } from "./types";

/** Whether a device is in the given state. Unknown pairings, such as a light that is "locked", never match. */
export function matches(device: Device | undefined, match: StateMatch): boolean {
  if (!device) return false;
  if (match.is === "offline") return !device.available;
  if (!device.available) return false;
  switch (match.is) {
    case "on":
    case "off":
      return (device.kind === "light" || device.kind === "switch" || device.kind === "fan") && device.on === (match.is === "on")
        || (device.kind === "thermostat" && (device.mode !== "off") === (match.is === "on"));
    case "open":
    case "closed":
      if (device.kind === "cover") return match.is === "open" ? device.state === "open" || device.state === "opening" : device.state === "closed";
      if (device.kind === "binary_sensor") return device.active === (match.is === "open");
      if (device.kind === "lock") return match.is === "open" ? device.state === "open" : false;
      return false;
    case "locked":
    case "unlocked":
      return device.kind === "lock" && device.state === match.is;
    case "active":
    case "clear":
      return device.kind === "binary_sensor" && device.active === (match.is === "active");
    case "rang":
      return false;
    case "above":
    case "below": {
      const value = device.kind === "sensor" ? device.value : device.kind === "thermostat" ? device.current : null;
      return value !== null && (match.is === "above" ? value > match.value : value < match.value);
    }
  }
}

/** A button or doorbell press is an event, not a state: it matches on the look where `last` moved. */
export const pressed = (before: Device | undefined, after: Device | undefined) => after?.kind === "event" && before?.kind === "event" && Boolean(after.last) && after.last !== before.last;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const at = (date: Date, minutes: number) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutes);
  return next;
};

/** When a time or sun trigger fires on a date, or null when it does not fire that day. */
export function fireTime(trigger: Trigger, date: Date, location: HomeLocation | null): Date | null {
  if (trigger.type === "device") return null;
  if (trigger.days.length && !trigger.days.includes(date.getDay())) return null;
  if (trigger.type === "time") return at(date, minutesOf(trigger.at));
  if (!location) return null;
  const sun = sunTimes(date, location.latitude, location.longitude);
  if (!sun) return null;
  return new Date((trigger.event === "sunrise" ? sun.sunrise : sun.sunset).getTime() + trigger.offset * 60_000);
}

export function conditionHolds(condition: Condition, devices: Map<string, Device>, now: Date, location: HomeLocation | null) {
  switch (condition.type) {
    case "time":
      return isNight({ dimFrom: condition.after, dimTo: condition.before }, now);
    case "sun": {
      const sun = location ? sunTimes(now, location.latitude, location.longitude) : null;
      if (!sun) return condition.when === "night" ? now.getHours() < 6 || now.getHours() >= 20 : now.getHours() >= 6 && now.getHours() < 20;
      const day = now >= sun.sunrise && now < sun.sunset;
      return condition.when === "day" ? day : !day;
    }
    case "device":
      return matches(devices.get(condition.deviceId), condition.match);
  }
}

/** A command as a verb phrase: "turn on Porch light", "set Pendants to 40%", "close Garage door". */
export function actionWords(device: Device, command: DeviceCommand) {
  switch (command.type) {
    case "power": return `turn ${command.on ? "on" : "off"} ${device.name}`;
    case "brightness": return `set ${device.name} to ${command.value}%`;
    case "color": return `make ${device.name} ${hsToHex(command)}`;
    case "temperature": return `set ${device.name} to ${command.kelvin} K white`;
    case "fanSpeed": return `set ${device.name} to speed ${command.value}%`;
    case "targetTemperature": return `set ${device.name} to ${command.value}°`;
    case "thermostatMode": return command.mode === "off" ? `turn off ${device.name}` : `set ${device.name} to ${command.mode}`;
    case "lock": return `${command.locked ? "lock" : "unlock"} ${device.name}`;
    case "cover": return `${command.action} ${device.name}`;
    case "coverPosition": return `open ${device.name} to ${command.value}%`;
    case "activate": return `run ${device.name}`;
  }
}

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const MATCH_WORDS: Record<StateMatch["is"], string> = {
  on: "turns on", off: "turns off", open: "opens", closed: "closes", locked: "locks", unlocked: "unlocks", active: "is triggered", clear: "clears",
  rang: "rings", offline: "goes offline", above: "goes above", below: "goes below",
};

function dayWords(days: number[]) {
  if (days.length === 0 || days.length === 7) return "every day";
  const sorted = [...days].sort();
  if (sorted.join() === "1,2,3,4,5") return "on weekdays";
  if (sorted.join() === "0,6") return "on weekends";
  return `on ${sorted.map(day => DAY_NAMES[day]).join(", ")}`;
}

const clockWords = (time: string) => at(new Date(2026, 0, 1), minutesOf(time)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The rule as one sentence, such as "At sunset every day, turn on Porch light." */
export function summarize(trigger: Trigger, actions: Action[], devices: Map<string, Device>, scenes: Map<string, { name: string }>) {
  const name = (id: string) => devices.get(id)?.name ?? "a device that is gone";
  let when: string;
  if (trigger.type === "time") when = `At ${clockWords(trigger.at)} ${dayWords(trigger.days)}`;
  else if (trigger.type === "sun") {
    const offset = trigger.offset === 0 ? "" : `${Math.abs(trigger.offset)} min ${trigger.offset < 0 ? "before" : "after"} `;
    when = `${offset ? offset[0].toUpperCase() + offset.slice(1) : "At "}${trigger.event} ${dayWords(trigger.days)}`;
  } else {
    const value = "value" in trigger.match ? ` ${trigger.match.value}` : "";
    when = `When ${name(trigger.deviceId)} ${MATCH_WORDS[trigger.match.is]}${value}${trigger.forMinutes ? ` and stays that way for ${trigger.forMinutes} min` : ""}`;
  }
  const does = actions.map(action => {
    if (action.type === "scene") return `run ${scenes.get(action.sceneId)?.name ?? "a scene"}`;
    if (action.type === "notify") return `send "${action.title}"`;
    const device = devices.get(action.deviceId);
    return device ? actionWords(device, action.command) : "control a device that is gone";
  });
  return `${when}, ${does.join(", then ")}.`;
}
