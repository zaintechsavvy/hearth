import { deviceId, type Device, type DeviceKind, type LockState, type ThermostatAction, type ThermostatMode } from "@/lib/devices/types";
import type { MatterNode } from "./client";

export const Cluster = {
  OnOff: 6, LevelControl: 8, Descriptor: 29, BasicInformation: 40, PowerSource: 47, BridgedBasicInformation: 57, Switch: 59, BooleanState: 69,
  DoorLock: 257, WindowCovering: 258, Thermostat: 513, FanControl: 514, Illuminance: 1024, Temperature: 1026, Humidity: 1029, Occupancy: 1030,
  CameraStreams: 1361,
} as const;

export const WindowCoveringAttribute = { OperationalStatus: 10, LiftPercent100ths: 14, FeatureMap: 65532 } as const;

export const ThermostatAttribute = {
  LocalTemperature: 0, AbsMinHeat: 3, AbsMaxHeat: 4, AbsMinCool: 5, AbsMaxCool: 6, OccupiedCooling: 17, OccupiedHeating: 18,
  MinHeat: 21, MaxHeat: 22, MinCool: 23, MaxCool: 24, ControlSequence: 27, SystemMode: 28, RunningState: 41, FeatureMap: 65532,
} as const;

export const FanAttribute = { FanMode: 0, PercentSetting: 2, PercentCurrent: 3 } as const;

export const SYSTEM_MODE: Record<ThermostatMode, number> = { off: 0, auto: 1, cool: 3, heat: 4 };
const MODE_FROM_SYSTEM: Record<number, ThermostatMode> = { 0: "off", 1: "auto", 3: "cool", 4: "heat", 5: "heat", 6: "cool" };

const LIGHT_TYPES = [0x0100, 0x0101, 0x010c, 0x010d];
const CONTACT_TYPE = 0x0015;
const LEAK_TYPE = 0x0043;
/** Matter device types worth naming when Hearth cannot show them yet. */
const TYPE_NAMES: Record<number, string> = { 0x0076: "smoke alarm", 0x0074: "robot vacuum", 0x0022: "speaker", 0x0023: "media player", 0x002c: "air purifier", 0x0072: "air conditioner", 0x0050: "pump", 0x0042: "valve" };
const LOAD_TYPES = [0x010a, 0x010b, 0x010f, 0x0110];
const FAN_TYPE = 0x002b;
const THERMOSTAT_TYPE = 0x0301;
const FEATURE = { heat: 0x1, cool: 0x2, auto: 0x20 };
const RUNNING = { heat: 0x1 | 0x8, cool: 0x2 | 0x10 };

const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const str = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export const attribute = (node: MatterNode, endpoint: number, cluster: number, id: number) => node.attributes[`${endpoint}/${cluster}/${id}`];

export const matterNativeId = (nodeId: string, endpoint: number) => `${nodeId}/${endpoint}`;

export function parseMatterNativeId(id: string) {
  const [nodeId, endpoint] = id.split("/");
  return { nodeId, endpoint: Number(endpoint) };
}

export function endpointsOf(node: MatterNode): number[] {
  const endpoints = new Set<number>();
  for (const key of Object.keys(node.attributes)) {
    const endpoint = Number(key.slice(0, key.indexOf("/")));
    if (endpoint > 0) endpoints.add(endpoint);
  }
  return [...endpoints].sort((a, b) => a - b);
}

export function hasCluster(node: MatterNode, endpoint: number, cluster: number) {
  const prefix = `${endpoint}/${cluster}/`;
  return Object.keys(node.attributes).some(key => key.startsWith(prefix));
}

/** DeviceTypeList entries are structs keyed by TLV tag: tag 0 is the device type. */
function deviceTypes(node: MatterNode, endpoint: number): number[] {
  const list = attribute(node, endpoint, Cluster.Descriptor, 0);
  if (!Array.isArray(list)) return [];
  return list.map(entry => Number((entry as Record<string, unknown>)?.["0"] ?? (entry as Record<string, unknown>)?.deviceType)).filter(Number.isFinite);
}

/** The one thing an endpoint does that can be controlled. Sensors on the same endpoint are mapped separately. */
export function classifyEndpoint(node: MatterNode, endpoint: number): DeviceKind | null {
  const types = deviceTypes(node, endpoint);
  if (types.includes(THERMOSTAT_TYPE) || hasCluster(node, endpoint, Cluster.Thermostat)) return "thermostat";
  if (hasCluster(node, endpoint, Cluster.WindowCovering)) return "cover";
  if (hasCluster(node, endpoint, Cluster.DoorLock)) return "lock";
  if (hasCluster(node, endpoint, Cluster.CameraStreams)) return "camera";
  if (types.includes(FAN_TYPE) || hasCluster(node, endpoint, Cluster.FanControl)) return "fan";
  if (!hasCluster(node, endpoint, Cluster.OnOff)) return null;
  if (types.some(type => LIGHT_TYPES.includes(type))) return "light";
  if (types.some(type => LOAD_TYPES.includes(type))) return "switch";
  return hasCluster(node, endpoint, Cluster.LevelControl) ? "light" : "switch";
}

const centi = (node: MatterNode, endpoint: number, id: number) => {
  const value = num(attribute(node, endpoint, Cluster.Thermostat, id));
  return value === null ? null : value / 100;
};

function thermostatModes(node: MatterNode, endpoint: number): ThermostatMode[] {
  const features = num(attribute(node, endpoint, Cluster.Thermostat, ThermostatAttribute.FeatureMap));
  const sequence = num(attribute(node, endpoint, Cluster.Thermostat, ThermostatAttribute.ControlSequence));
  const heat = features ? (features & FEATURE.heat) !== 0 : sequence === null || sequence >= 2;
  const cool = features ? (features & FEATURE.cool) !== 0 : sequence === null || sequence <= 1 || sequence >= 4;
  const auto = features ? (features & FEATURE.auto) !== 0 : heat && cool;
  return (["off", heat && "heat", cool && "cool", auto && "auto"] as const).filter((mode): mode is ThermostatMode => Boolean(mode));
}

type Base = Pick<Device, "id" | "integrationId" | "name" | "room" | "available">;

const LOCK_STATES: Record<number, LockState> = { 0: "unlocked", 1: "locked", 2: "unlocked", 3: "open" };

export interface MappedNode {
  devices: Device[];
  /** Endpoints that expose nothing Hearth understands, named by device type. */
  unsupported: string[];
}

/**
 * Maps a node to devices: one per controllable endpoint, plus one per reading (contact, motion, temperature,
 * humidity, light level, battery) and per button. `events` holds the last press time per `node/endpoint`.
 */
export function mapMatterNode(integrationId: string, node: MatterNode, events: ReadonlyMap<string, string> = new Map()): MappedNode {
  const nodeId = String(node.node_id);
  const nodeName = str(attribute(node, 0, Cluster.BasicInformation, 5)) ?? str(attribute(node, 0, Cluster.BasicInformation, 3)) ?? `Matter device ${nodeId}`;
  const devices: Device[] = [];
  const unsupported: string[] = [];

  for (const endpoint of endpointsOf(node)) {
    const name = str(attribute(node, endpoint, Cluster.BridgedBasicInformation, 5)) ?? str(attribute(node, endpoint, Cluster.BridgedBasicInformation, 3)) ?? nodeName;
    const base = (suffix?: string, label?: string): Base => ({
      id: deviceId(integrationId, suffix ? `${matterNativeId(nodeId, endpoint)}/${suffix}` : matterNativeId(nodeId, endpoint)),
      integrationId,
      name: label ? `${name} ${label}` : name,
      room: null,
      available: node.available,
    });
    const before = devices.length;
    const kind = classifyEndpoint(node, endpoint);
    if (kind) devices.push(mapPrimary(kind, base(), node, endpoint));
    const readings = mapReadings(node, endpoint, events, nodeId, Boolean(kind), base);
    devices.push(...readings);
    if (devices.length === before) {
      const types = deviceTypes(node, endpoint).filter(type => type !== 0x000e && type !== 0x0013 && type !== 0x0011);
      if (types.length) unsupported.push(TYPE_NAMES[types[0]] ?? `device type 0x${types[0].toString(16).padStart(4, "0")}`);
    }
  }

  const seen = new Map<string, number>();
  return {
    devices: devices.map(device => {
      const count = (seen.get(device.name) ?? 0) + 1;
      seen.set(device.name, count);
      return count > 1 ? { ...device, name: `${device.name} ${count}` } : device;
    }),
    unsupported,
  };
}

function mapPrimary(kind: DeviceKind, base: Base, node: MatterNode, endpoint: number): Device {
  const on = attribute(node, endpoint, Cluster.OnOff, 0) === true;
  switch (kind) {
    case "light": {
      const level = num(attribute(node, endpoint, Cluster.LevelControl, 0));
      return { ...base, kind, on, dimmable: hasCluster(node, endpoint, Cluster.LevelControl), brightness: on && level !== null ? Math.round(level / 254 * 100) : 0 };
    }
    case "fan": {
      const mode = num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.FanMode));
      const percent = num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentCurrent)) ?? num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentSetting));
      const fanOn = mode !== null ? mode !== 0 : (percent ?? 0) > 0;
      return { ...base, kind, on: fanOn, adjustable: attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentSetting) !== undefined, speed: fanOn ? percent || 100 : 0 };
    }
    case "thermostat":
      return mapThermostat(base, node, endpoint);
    case "lock":
      return { ...base, kind, state: LOCK_STATES[num(attribute(node, endpoint, Cluster.DoorLock, 0)) ?? -1] ?? "unknown" };
    case "cover": {
      // Matter counts lift as closed percentage in hundredths; Hearth's position is percent open.
      const lift = num(attribute(node, endpoint, Cluster.WindowCovering, WindowCoveringAttribute.LiftPercent100ths));
      const moving = (num(attribute(node, endpoint, Cluster.WindowCovering, WindowCoveringAttribute.OperationalStatus)) ?? 0) & 0b11;
      const features = num(attribute(node, endpoint, Cluster.WindowCovering, WindowCoveringAttribute.FeatureMap)) ?? 0;
      const position = lift === null ? null : Math.round(100 - lift / 100);
      return {
        ...base,
        kind,
        coverClass: /garage/i.test(base.name) ? "garage" : /gate/i.test(base.name) ? "gate" : /door/i.test(base.name) ? "door" : "blind",
        state: moving === 1 ? "opening" : moving === 2 ? "closing" : position === null ? "unknown" : position > 0 ? "open" : "closed",
        position,
        canStop: true,
        canSetPosition: (features & 0x4) !== 0,
      };
    }
    case "camera":
      return { ...base, kind, streamable: false };
    default:
      return { ...base, kind: "switch", on };
  }
}

function mapReadings(node: MatterNode, endpoint: number, events: ReadonlyMap<string, string>, nodeId: string, hasPrimary: boolean, base: (suffix?: string, label?: string) => Base): Device[] {
  const readings: Device[] = [];
  const types = deviceTypes(node, endpoint);
  const labelled = (suffix: string, label: string) => base(suffix, hasPrimary || readings.length > 0 ? label : undefined);

  if (hasCluster(node, endpoint, Cluster.BooleanState)) {
    const value = attribute(node, endpoint, Cluster.BooleanState, 0) === true;
    const leak = types.includes(LEAK_TYPE);
    const contact = types.includes(CONTACT_TYPE) || !leak;
    // A contact sensor reports true while the two halves touch, so "active" (open) is the opposite.
    readings.push({ ...labelled("state", leak ? "leak" : "contact"), kind: "binary_sensor", sensorClass: leak ? "leak" : /garage/i.test(base().name) ? "garage" : /window/i.test(base().name) ? "window" : contact ? "door" : "other", active: leak ? value : !value });
  }
  if (hasCluster(node, endpoint, Cluster.Occupancy)) {
    readings.push({ ...labelled("occupancy", "motion"), kind: "binary_sensor", sensorClass: "occupancy", active: ((num(attribute(node, endpoint, Cluster.Occupancy, 0)) ?? 0) & 1) === 1 });
  }
  if (hasCluster(node, endpoint, Cluster.Temperature) && !hasCluster(node, endpoint, Cluster.Thermostat)) {
    const value = num(attribute(node, endpoint, Cluster.Temperature, 0));
    readings.push({ ...labelled("temperature", "temperature"), kind: "sensor", sensorClass: "temperature", value: value === null ? null : Math.round(value) / 100, unit: "°C" });
  }
  if (hasCluster(node, endpoint, Cluster.Humidity)) {
    const value = num(attribute(node, endpoint, Cluster.Humidity, 0));
    readings.push({ ...labelled("humidity", "humidity"), kind: "sensor", sensorClass: "humidity", value: value === null ? null : Math.round(value) / 100, unit: "%" });
  }
  if (hasCluster(node, endpoint, Cluster.Illuminance)) {
    const value = num(attribute(node, endpoint, Cluster.Illuminance, 0));
    readings.push({ ...labelled("illuminance", "light level"), kind: "sensor", sensorClass: "illuminance", value: value === null || value === 0 ? null : Math.round(10 ** ((value - 1) / 10000)), unit: "lx" });
  }
  if (hasCluster(node, endpoint, Cluster.Switch)) {
    readings.push({ ...labelled("button", "button"), kind: "event", eventClass: /doorbell/i.test(base().name) ? "doorbell" : "button", last: events.get(`${nodeId}/${endpoint}`) ?? null });
  }
  const battery = num(attribute(node, endpoint, Cluster.PowerSource, 12));
  if (battery !== null) {
    readings.push({ ...base("battery", "battery"), kind: "sensor", sensorClass: "battery", value: Math.round(battery / 2), unit: "%" });
  }
  return readings;
}

function mapThermostat(base: Base, node: MatterNode, endpoint: number): Device {
  const mode = MODE_FROM_SYSTEM[num(attribute(node, endpoint, Cluster.Thermostat, ThermostatAttribute.SystemMode)) ?? 0] ?? "off";
  const heating = centi(node, endpoint, ThermostatAttribute.OccupiedHeating);
  const cooling = centi(node, endpoint, ThermostatAttribute.OccupiedCooling);
  const target = mode === "cool" ? cooling
    : mode === "auto" && heating !== null && cooling !== null ? Math.round(heating + cooling) / 2
    : heating ?? cooling;
  const coolLimits = mode === "cool";
  const running = num(attribute(node, endpoint, Cluster.Thermostat, ThermostatAttribute.RunningState));
  const action: ThermostatAction | null = mode === "off" ? "off"
    : running === null ? null
    : running & RUNNING.heat ? "heating"
    : running & RUNNING.cool ? "cooling"
    : "idle";
  return {
    ...base,
    kind: "thermostat",
    unit: "C",
    current: centi(node, endpoint, ThermostatAttribute.LocalTemperature),
    target,
    min: coolLimits
      ? centi(node, endpoint, ThermostatAttribute.MinCool) ?? centi(node, endpoint, ThermostatAttribute.AbsMinCool) ?? 16
      : centi(node, endpoint, ThermostatAttribute.MinHeat) ?? centi(node, endpoint, ThermostatAttribute.AbsMinHeat) ?? 7,
    max: coolLimits
      ? centi(node, endpoint, ThermostatAttribute.MaxCool) ?? centi(node, endpoint, ThermostatAttribute.AbsMaxCool) ?? 32
      : centi(node, endpoint, ThermostatAttribute.MaxHeat) ?? centi(node, endpoint, ThermostatAttribute.AbsMaxHeat) ?? 30,
    step: 0.5,
    mode,
    modes: thermostatModes(node, endpoint),
    action,
  };
}
