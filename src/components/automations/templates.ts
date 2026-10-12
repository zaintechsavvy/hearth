import type { AutomationInput } from "@/lib/automations/types";
import type { Device } from "@/lib/devices/types";

export interface Template {
  id: string;
  title: string;
  description: string;
  build: (devices: Device[]) => AutomationInput | null;
}

const lights = (devices: Device[]) => devices.filter(device => device.kind === "light" && device.available);
const named = (devices: Device[], pattern: RegExp) => devices.find(device => pattern.test(`${device.name} ${device.room ?? ""}`));

/** Ready-made rules, filled in from the devices this home actually has. A template that needs a missing device is hidden. */
export const TEMPLATES: Template[] = [
  {
    id: "sunset-porch",
    title: "Porch light at sunset",
    description: "Turns the outside light on as the sun goes down.",
    build: devices => {
      const light = named(lights(devices), /porch|outside|front|garden|patio|yard/i) ?? lights(devices)[0];
      return light ? { name: "Porch light at sunset", enabled: true, trigger: { type: "sun", event: "sunset", offset: 0, days: [] }, conditions: [], actions: [{ type: "device", deviceId: light.id, command: { type: "power", on: true } }] } : null;
    },
  },
  {
    id: "bedtime",
    title: "Lights out at bedtime",
    description: "Every light off at 11 PM, so nothing is left burning.",
    build: devices => {
      const all = lights(devices).slice(0, 12);
      return all.length ? { name: "Lights out at bedtime", enabled: true, trigger: { type: "time", at: "23:00", days: [] }, conditions: [], actions: all.map(light => ({ type: "device" as const, deviceId: light.id, command: { type: "power" as const, on: false } })) } : null;
    },
  },
  {
    id: "garage-open",
    title: "Garage left open",
    description: "An alert after ten minutes open, then it closes itself.",
    build: devices => {
      const garage = devices.find(device => device.kind === "cover" && device.coverClass === "garage");
      return garage ? {
        name: "Garage left open", enabled: true, trigger: { type: "device", deviceId: garage.id, match: { is: "open" }, forMinutes: 10 }, conditions: [],
        actions: [{ type: "notify", title: `${garage.name} was left open`, body: "Hearth is closing it." }, { type: "device", deviceId: garage.id, command: { type: "cover", action: "close" } }],
      } : null;
    },
  },
  {
    id: "leak",
    title: "Leak alarm",
    description: "An alert the moment a leak sensor gets wet.",
    build: devices => {
      const leak = devices.find(device => device.kind === "binary_sensor" && device.sensorClass === "leak");
      return leak ? { name: "Leak alarm", enabled: true, trigger: { type: "device", deviceId: leak.id, match: { is: "active" }, forMinutes: 0 }, conditions: [], actions: [{ type: "notify", title: `Leak at ${leak.name}`, body: "Check it now." }] } : null;
    },
  },
  {
    id: "welcome",
    title: "Welcome home after dark",
    description: "Unlock the door at night and the entry light comes on.",
    build: devices => {
      const lock = devices.find(device => device.kind === "lock");
      const light = lock && (lights(devices).find(device => device.room && device.room === lock.room) ?? named(lights(devices), /hall|entry|porch|front/i) ?? lights(devices)[0]);
      return lock && light ? {
        name: "Welcome home after dark", enabled: true, trigger: { type: "device", deviceId: lock.id, match: { is: "unlocked" }, forMinutes: 0 }, conditions: [{ type: "sun", when: "night" }],
        actions: [{ type: "device", deviceId: light.id, command: { type: "power", on: true } }],
      } : null;
    },
  },
  {
    id: "morning",
    title: "Good morning",
    description: "Kitchen lights and heat on at 7 on weekdays.",
    build: devices => {
      const kitchen = lights(devices).filter(device => /kitchen/i.test(device.room ?? device.name)).slice(0, 4);
      const thermostat = devices.find(device => device.kind === "thermostat" && device.modes.includes("heat"));
      const actions = [
        ...kitchen.map(light => ({ type: "device" as const, deviceId: light.id, command: { type: "power" as const, on: true } })),
        ...(thermostat && thermostat.kind === "thermostat" ? [{ type: "device" as const, deviceId: thermostat.id, command: { type: "thermostatMode" as const, mode: "heat" as const } }] : []),
      ];
      return actions.length ? { name: "Good morning", enabled: true, trigger: { type: "time", at: "07:00", days: [1, 2, 3, 4, 5] }, conditions: [], actions } : null;
    },
  },
];
