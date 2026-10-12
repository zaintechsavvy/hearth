import {
  clamp, deviceId, type BinarySensorClass, type CoverClass, type CoverState, type Device, type DeviceCommand, type EventClass, type LockState,
  type SceneVariant, type SensorClass, type TemperatureUnit, type ThermostatAction, type ThermostatMode,
} from "@/lib/devices/types";
import { homeAssistantLive, type HomeAssistantLive } from "./home-assistant-live";
import { IntegrationError, countBy, type DeviceList, type Provider } from "./types";

export interface HassState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface HassConfig {
  unit_system?: { temperature?: string };
}

const FAN_SET_SPEED = 1;
const COVER = { open: 1, close: 2, setPosition: 4, stop: 8 };

const HVAC_TO_MODE: Record<string, ThermostatMode> = { off: "off", heat: "heat", cool: "cool", heat_cool: "auto", auto: "auto" };
const ACTIONS: Record<string, ThermostatAction> = { heating: "heating", preheating: "heating", cooling: "cooling", idle: "idle", off: "off" };
const LOCK_STATES: Record<string, LockState> = { locked: "locked", unlocked: "unlocked", locking: "locking", unlocking: "unlocking", jammed: "jammed", open: "open", opening: "unlocking" };
const COVER_CLASSES: Record<string, CoverClass> = { garage: "garage", door: "door", gate: "gate", blind: "blind", shutter: "blind", awning: "blind", shade: "shade", curtain: "curtain", window: "window" };
const COVER_STATES: Record<string, CoverState> = { open: "open", closed: "closed", opening: "opening", closing: "closing", stopped: "stopped" };
const BINARY_CLASSES: Record<string, BinarySensorClass> = {
  door: "door", window: "window", garage_door: "garage", opening: "opening", motion: "motion", occupancy: "occupancy", presence: "occupancy",
  moisture: "leak", smoke: "smoke", gas: "smoke", carbon_monoxide: "smoke",
};
const SENSOR_CLASSES: Record<string, SensorClass> = {
  temperature: "temperature", humidity: "humidity", battery: "battery", illuminance: "illuminance", power: "power", energy: "energy",
  carbon_dioxide: "co2", pm25: "pm25",
};
const EVENT_CLASSES: Record<string, EventClass> = { doorbell: "doorbell", button: "button", motion: "motion" };
const SCENE_DOMAINS: Record<string, SceneVariant> = { scene: "scene", script: "script", button: "button", input_button: "button" };

/** Areas are not in the REST state objects; a template renders `entity_id<TAB>area` for every entity in one request. */
const AREA_TEMPLATE = "{% for s in states %}{{ s.entity_id }}\t{{ area_name(s.entity_id) or '' }}\n{% endfor %}";

export function parseAreas(rendered: string) {
  const areas = new Map<string, string>();
  for (const line of rendered.split("\n")) {
    const [entityId, area] = line.split("\t");
    if (entityId && area?.trim()) areas.set(entityId.trim(), area.trim());
  }
  return areas;
}

const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const str = (value: unknown) => typeof value === "string" ? value : null;
const timestamp = (value: string) => Number.isNaN(Date.parse(value)) ? null : value;

export function mapHassState(integrationId: string, entity: HassState, unit: TemperatureUnit, room: string | null = null): Device | null {
  const domain = entity.entity_id.split(".")[0];
  const { attributes } = entity;
  const deviceClass = str(attributes.device_class);
  const base = {
    id: deviceId(integrationId, entity.entity_id),
    integrationId,
    name: str(attributes.friendly_name) ?? entity.entity_id,
    room,
    available: entity.state !== "unavailable",
  };
  const on = entity.state === "on";
  const features = num(attributes.supported_features) ?? 0;

  switch (domain) {
    case "light": {
      const colorModes = Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes : [];
      const dimmable = colorModes.some(mode => mode !== "onoff");
      const brightness = num(attributes.brightness);
      return { ...base, kind: "light", on, dimmable, brightness: on && brightness !== null ? Math.round(brightness / 255 * 100) : 0 };
    }
    case "switch":
    case "input_boolean":
      return { ...base, kind: "switch", on };
    case "fan":
      return { ...base, kind: "fan", on, adjustable: (features & FAN_SET_SPEED) !== 0, speed: on ? num(attributes.percentage) ?? 100 : 0 };
    case "climate": {
      const hvacModes = Array.isArray(attributes.hvac_modes) ? attributes.hvac_modes.map(String) : [];
      const modes = [...new Set(hvacModes.map(mode => HVAC_TO_MODE[mode]).filter(Boolean))];
      const low = num(attributes.target_temp_low), high = num(attributes.target_temp_high);
      const step = num(attributes.target_temp_step) ?? (unit === "F" ? 1 : 0.5);
      const target = num(attributes.temperature) ?? (low !== null && high !== null ? roundTo((low + high) / 2, step) : null);
      return {
        ...base,
        kind: "thermostat",
        unit,
        current: num(attributes.current_temperature),
        target,
        min: num(attributes.min_temp) ?? (unit === "F" ? 45 : 7),
        max: num(attributes.max_temp) ?? (unit === "F" ? 95 : 35),
        step,
        mode: HVAC_TO_MODE[entity.state] ?? "off",
        modes: modes.length ? modes : ["off", "heat"],
        action: typeof attributes.hvac_action === "string" ? ACTIONS[attributes.hvac_action] ?? "idle" : null,
      };
    }
    case "lock":
      return { ...base, kind: "lock", state: LOCK_STATES[entity.state] ?? "unknown" };
    case "cover":
      return {
        ...base,
        kind: "cover",
        coverClass: COVER_CLASSES[deviceClass ?? ""] ?? "other",
        state: COVER_STATES[entity.state] ?? "unknown",
        position: num(attributes.current_position),
        canStop: (features & COVER.stop) !== 0,
        canSetPosition: (features & COVER.setPosition) !== 0,
      };
    case "binary_sensor":
      return { ...base, kind: "binary_sensor", sensorClass: BINARY_CLASSES[deviceClass ?? ""] ?? "other", active: on };
    case "sensor": {
      const sensorClass = SENSOR_CLASSES[deviceClass ?? ""];
      if (!sensorClass) return null;
      const value = Number.parseFloat(entity.state);
      return { ...base, kind: "sensor", sensorClass, value: Number.isFinite(value) ? value : null, unit: str(attributes.unit_of_measurement) };
    }
    case "camera":
      return { ...base, kind: "camera", streamable: true };
    case "event":
      return { ...base, kind: "event", eventClass: EVENT_CLASSES[deviceClass ?? ""] ?? "other", last: timestamp(entity.state) };
    default: {
      const variant = SCENE_DOMAINS[domain];
      return variant ? { ...base, kind: "scene", variant, available: true } : null;
    }
  }
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export class HomeAssistantProvider implements Provider {
  private readonly base: URL;
  private readonly token: string;
  private readonly live: HomeAssistantLive;
  private static readonly areaCache = new Map<string, { at: number; areas: Map<string, string> }>();

  constructor(private readonly integrationId: string, config: { url: string; token: string }) {
    this.base = new URL(config.url.endsWith("/") ? config.url : `${config.url}/`);
    this.token = config.token;
    this.live = homeAssistantLive(this.base.toString(), this.token, integrationId);
  }

  subscribe(onChange: () => void) {
    return this.live.subscribe(onChange);
  }

  /** Areas change rarely and cost a template render, so they are cached for a few minutes. */
  private async areas() {
    const cached = HomeAssistantProvider.areaCache.get(this.integrationId);
    if (cached && Date.now() - cached.at < 300_000) return cached.areas;
    const areas = await this.request<string>("api/template", { method: "POST", body: JSON.stringify({ template: AREA_TEMPLATE }) }, "text").then(parseAreas, () => new Map<string, string>());
    HomeAssistantProvider.areaCache.set(this.integrationId, { at: Date.now(), areas });
    return areas;
  }

  private async request<T>(path: string, init?: RequestInit, parse: "json" | "text" = "json"): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.base), {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      });
    } catch {
      throw new IntegrationError(`Could not reach Home Assistant at ${this.base.origin}.`);
    }
    if (response.status === 401) throw new IntegrationError("Home Assistant rejected the access token.");
    if (!response.ok) throw new IntegrationError(`Home Assistant answered with ${response.status} ${response.statusText}.`);
    return (parse === "json" ? response.json() : response.text()) as Promise<T>;
  }

  async check() {
    await this.request("api/");
  }

  async listDevices() {
    const mirrored = this.live.snapshot();
    const [unit, states, areas] = mirrored
      ? [this.live.unit, mirrored, await this.areas()] as const
      : await Promise.all([
        this.request<HassConfig>("api/config").then((config): TemperatureUnit => config.unit_system?.temperature === "°F" ? "F" : "C"),
        this.request<HassState[]>("api/states"),
        this.areas(),
      ]);
    const devices: Device[] = [];
    const skipped: string[] = [];
    for (const state of states) {
      const device = mapHassState(this.integrationId, state, unit, areas.get(state.entity_id) ?? null);
      if (!device) skipped.push(state.entity_id.split(".")[0]);
      else devices.push(this.live.auxiliary.has(state.entity_id) ? { ...device, auxiliary: true } : device);
    }
    return { devices, unsupported: countBy(skipped) } satisfies DeviceList;
  }

  /** Waits briefly for the WebSocket mirror so diagnostic and settings entities are marked before anyone chooses. */
  async review() {
    await this.live.waitUntilReady(5000);
    return this.listDevices();
  }

  /** Home Assistant already turns every camera it knows into MJPEG and JPEG, whatever the camera speaks. */
  async camera(entityId: string, mode: "stream" | "snapshot", signal: AbortSignal) {
    if (!entityId.startsWith("camera.")) throw new IntegrationError("That device is not a camera.");
    try {
      return await fetch(new URL(`api/${mode === "stream" ? "camera_proxy_stream" : "camera_proxy"}/${entityId}`, this.base), {
        headers: { Authorization: `Bearer ${this.token}` },
        cache: "no-store",
        signal,
      });
    } catch {
      throw new IntegrationError(`Could not reach Home Assistant at ${this.base.origin}.`);
    }
  }

  private call(domain: string, service: string, data: Record<string, unknown>) {
    return this.request(`api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) });
  }

  async execute(entityId: string, command: DeviceCommand) {
    const domain = entityId.split(".")[0];
    const target = { entity_id: entityId };
    switch (command.type) {
      case "power":
        if (domain === "climate") {
          const entity = await this.request<HassState>(`api/states/${entityId}`);
          const modes = (entity.attributes.hvac_modes as string[] | undefined) ?? [];
          return void await this.call("climate", "set_hvac_mode", { ...target, hvac_mode: command.on ? modes.find(mode => mode !== "off") ?? "heat" : "off" });
        }
        return void await this.call(domain === "light" ? "light" : "homeassistant", command.on ? "turn_on" : "turn_off", target);
      case "brightness":
        return void await (command.value <= 0
          ? this.call("light", "turn_off", target)
          : this.call("light", "turn_on", { ...target, brightness_pct: clamp(Math.round(command.value), 1, 100) }));
      case "fanSpeed":
        return void await this.call("fan", "set_percentage", { ...target, percentage: clamp(Math.round(command.value), 0, 100) });
      case "targetTemperature":
        return void await this.setTemperature(entityId, command.value);
      case "thermostatMode": {
        const entity = await this.request<HassState>(`api/states/${entityId}`);
        const modes = (entity.attributes.hvac_modes as string[] | undefined) ?? [];
        const hvacMode = command.mode === "auto" ? modes.find(mode => mode === "heat_cool") ?? "auto" : command.mode;
        return void await this.call("climate", "set_hvac_mode", { ...target, hvac_mode: hvacMode });
      }
      case "lock":
        return void await this.call("lock", command.locked ? "lock" : "unlock", target);
      case "cover":
        return void await this.call("cover", `${command.action}_cover`, target);
      case "coverPosition":
        return void await this.call("cover", "set_cover_position", { ...target, position: clamp(Math.round(command.value), 0, 100) });
      case "activate":
        return void await this.call(domain, domain === "button" || domain === "input_button" ? "press" : "turn_on", target);
    }
  }

  /** Range thermostats keep their spread: both setpoints move by the same amount. */
  private async setTemperature(entityId: string, value: number) {
    const { attributes } = await this.request<HassState>(`api/states/${entityId}`);
    const low = num(attributes.target_temp_low), high = num(attributes.target_temp_high);
    if (num(attributes.temperature) === null && low !== null && high !== null) {
      const shift = value - (low + high) / 2;
      return this.call("climate", "set_temperature", { entity_id: entityId, target_temp_low: low + shift, target_temp_high: high + shift });
    }
    return this.call("climate", "set_temperature", { entity_id: entityId, temperature: value });
  }
}
