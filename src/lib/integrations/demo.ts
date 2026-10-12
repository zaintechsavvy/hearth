import { applyCommand, deviceId, type Device, type DeviceCommand } from "@/lib/devices/types";
import { IntegrationError, type DeviceList, type Provider } from "./types";

interface DemoHome {
  devices: Map<string, Device>;
  updatedAt: number;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setInterval>;
}

const registry = globalThis as unknown as { hearthDemoHomes?: Map<string, DemoHome> };
const homes = registry.hearthDemoHomes ??= new Map();

/** Degrees per second the simulated room moves toward its setpoint. */
const HEATING_RATE = 0.02;
const AMBIENT = 20.5;
/** How often a watched demo home advances its simulation and pushes the result. */
const TICK_MS = 5000;
/** How long the demo garage door takes to travel. */
const TRAVEL_MS = 3000;

export function seedDemoDevices(integrationId: string): Device[] {
  const base = (nativeId: string, name: string, room: string | null) => ({ id: deviceId(integrationId, nativeId), integrationId, name, room, available: true });
  return [
    { ...base("thermostat", "Living room", "Living room"), kind: "thermostat", unit: "C", current: 20.5, target: 22, min: 10, max: 30, step: 0.5, mode: "heat", modes: ["off", "heat", "cool", "auto"], action: "heating" },
    { ...base("kitchen-pendants", "Pendants", "Kitchen"), kind: "light", on: true, dimmable: true, brightness: 80, supportsColor: true, color: { hue: 32, saturation: 70 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("living-lamp", "Floor lamp", "Living room"), kind: "light", on: true, dimmable: true, brightness: 45, supportsColor: false, color: null, colorMode: "white", temperatureRange: { min: 2200, max: 5000 }, temperature: 2700 },
    { ...base("porch", "Porch light", "Outside"), kind: "light", on: false, dimmable: false, brightness: 0, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null },
    { ...base("bedroom-fan", "Ceiling fan", "Bedroom"), kind: "fan", on: true, adjustable: true, speed: 40 },
    { ...base("coffee", "Coffee machine", "Kitchen"), kind: "switch", on: false },
    { ...base("office-plug", "Desk", "Office"), kind: "switch", on: true },
    { ...base("bedside", "Bedside lamp", "Bedroom"), kind: "light", on: false, dimmable: true, brightness: 0, supportsColor: true, color: { hue: 265, saturation: 55 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("tv", "Television", "Living room"), kind: "switch", on: false },
    { ...base("front-lock", "Front door", "Entry"), kind: "lock", state: "locked" },
    { ...base("garage", "Garage door", "Garage"), kind: "cover", coverClass: "garage", state: "closed", position: 0, canStop: true, canSetPosition: false },
    { ...base("back-door", "Back door", "Kitchen"), kind: "binary_sensor", sensorClass: "door", active: false },
    { ...base("back-door-battery", "Back door battery", "Kitchen"), kind: "sensor", sensorClass: "battery", value: 82, unit: "%" },
    { ...base("hall-temp", "Hallway", "Entry"), kind: "sensor", sensorClass: "temperature", value: 21.4, unit: "°C" },
    { ...base("doorbell", "Doorbell", "Entry"), kind: "event", eventClass: "doorbell", last: null },
    { ...base("evening", "Evening", null), kind: "scene", variant: "scene" },
  ];
}

/** Moves each thermostat toward its setpoint since the last read, so the demo feels alive. */
function simulate(home: DemoHome, now: number) {
  const seconds = (now - home.updatedAt) / 1000;
  home.updatedAt = now;
  for (const [id, device] of home.devices) {
    if (device.kind !== "thermostat" || device.current === null) continue;
    const goal = device.mode === "off" || device.target === null ? AMBIENT : device.target;
    const heats = device.mode !== "off" && device.mode !== "cool" && goal > device.current + 0.05;
    const cools = device.mode !== "off" && device.mode !== "heat" && goal < device.current - 0.05;
    const drift = Math.min(Math.abs(goal - device.current), seconds * HEATING_RATE) * Math.sign(goal - device.current);
    const current = heats || cools || device.mode === "off" ? device.current + drift : device.current;
    home.devices.set(id, { ...device, current: Math.round(current * 10) / 10, action: device.mode === "off" ? "off" : heats ? "heating" : cools ? "cooling" : "idle" });
  }
}

function notify(home: DemoHome) {
  for (const listener of home.listeners) listener();
}

export class DemoProvider implements Provider {
  constructor(private readonly integrationId: string) {}

  private home() {
    let home = homes.get(this.integrationId);
    if (!home) {
      home = { devices: new Map(seedDemoDevices(this.integrationId).map(device => [device.id, device])), updatedAt: Date.now(), listeners: new Set() };
      homes.set(this.integrationId, home);
    }
    simulate(home, Date.now());
    return home;
  }

  async check() {}

  subscribe(onChange: () => void) {
    const home = this.home();
    home.listeners.add(onChange);
    home.timer ??= setInterval(() => {
      const before = JSON.stringify([...home.devices.values()]);
      simulate(home, Date.now());
      if (JSON.stringify([...home.devices.values()]) !== before) notify(home);
    }, TICK_MS);
    return () => {
      home.listeners.delete(onChange);
      if (home.listeners.size === 0 && home.timer) {
        clearInterval(home.timer);
        home.timer = undefined;
      }
    };
  }

  async listDevices(): Promise<DeviceList> {
    return { devices: [...this.home().devices.values()], unsupported: {} };
  }

  async execute(nativeId: string, command: DeviceCommand) {
    const home = this.home();
    const id = deviceId(this.integrationId, nativeId);
    const device = home.devices.get(id);
    if (!device) throw new IntegrationError("That demo device does not exist.");
    await new Promise(resolve => setTimeout(resolve, 180));
    home.devices.set(id, applyCommand(device, command));
    notify(home);
    if (device.kind === "cover" && command.type === "cover" && command.action !== "stop") {
      setTimeout(() => {
        const current = home.devices.get(id);
        if (current?.kind !== "cover" || current.state === "stopped") return;
        const open = command.action === "open";
        home.devices.set(id, { ...current, state: open ? "open" : "closed", position: open ? 100 : 0 });
        notify(home);
      }, TRAVEL_MS);
    }
  }
}
