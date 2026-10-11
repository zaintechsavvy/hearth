import { applyCommand, deviceId, type Device, type DeviceCommand } from "@/lib/devices/types";
import { IntegrationError, type Provider } from "./types";

interface DemoHome {
  devices: Map<string, Device>;
  updatedAt: number;
}

const registry = globalThis as unknown as { hearthDemoHomes?: Map<string, DemoHome> };
const homes = registry.hearthDemoHomes ??= new Map();

/** Degrees per second the simulated room moves toward its setpoint. */
const HEATING_RATE = 0.02;
const AMBIENT = 20.5;

export function seedDemoDevices(integrationId: string): Device[] {
  const base = (nativeId: string, name: string) => ({ id: deviceId(integrationId, nativeId), integrationId, name, available: true });
  return [
    { ...base("thermostat", "Living room"), kind: "thermostat", unit: "C", current: 20.5, target: 22, min: 10, max: 30, step: 0.5, mode: "heat", modes: ["off", "heat", "cool", "auto"], action: "heating" },
    { ...base("kitchen-pendants", "Kitchen pendants"), kind: "light", on: true, dimmable: true, brightness: 80 },
    { ...base("living-lamp", "Living room lamp"), kind: "light", on: true, dimmable: true, brightness: 45 },
    { ...base("porch", "Porch light"), kind: "light", on: false, dimmable: false, brightness: 0 },
    { ...base("bedroom-fan", "Bedroom fan"), kind: "fan", on: true, adjustable: true, speed: 40 },
    { ...base("coffee", "Coffee machine"), kind: "switch", on: false },
    { ...base("office-plug", "Office desk"), kind: "switch", on: true },
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

export class DemoProvider implements Provider {
  constructor(private readonly integrationId: string) {}

  private home() {
    let home = homes.get(this.integrationId);
    if (!home) {
      home = { devices: new Map(seedDemoDevices(this.integrationId).map(device => [device.id, device])), updatedAt: Date.now() };
      homes.set(this.integrationId, home);
    }
    simulate(home, Date.now());
    return home;
  }

  async check() {}

  async listDevices() {
    return [...this.home().devices.values()];
  }

  async execute(nativeId: string, command: DeviceCommand) {
    const home = this.home();
    const id = deviceId(this.integrationId, nativeId);
    const device = home.devices.get(id);
    if (!device) throw new IntegrationError("That demo device does not exist.");
    await new Promise(resolve => setTimeout(resolve, 180));
    home.devices.set(id, applyCommand(device, command));
  }
}
