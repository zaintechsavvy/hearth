import { deviceId, type Device, type DeviceKind, type ThermostatAction, type ThermostatMode } from "@/lib/devices/types";
import type { MatterNode } from "./client";

export const Cluster = { OnOff: 6, LevelControl: 8, Descriptor: 29, BasicInformation: 40, BridgedBasicInformation: 57, Thermostat: 513, FanControl: 514 } as const;

export const ThermostatAttribute = {
  LocalTemperature: 0, AbsMinHeat: 3, AbsMaxHeat: 4, AbsMinCool: 5, AbsMaxCool: 6, OccupiedCooling: 17, OccupiedHeating: 18,
  MinHeat: 21, MaxHeat: 22, MinCool: 23, MaxCool: 24, ControlSequence: 27, SystemMode: 28, RunningState: 41, FeatureMap: 65532,
} as const;

export const FanAttribute = { FanMode: 0, PercentSetting: 2, PercentCurrent: 3 } as const;

export const SYSTEM_MODE: Record<ThermostatMode, number> = { off: 0, auto: 1, cool: 3, heat: 4 };
const MODE_FROM_SYSTEM: Record<number, ThermostatMode> = { 0: "off", 1: "auto", 3: "cool", 4: "heat", 5: "heat", 6: "cool" };

const LIGHT_TYPES = [0x0100, 0x0101, 0x010c, 0x010d];
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

export function classifyEndpoint(node: MatterNode, endpoint: number): DeviceKind | null {
  const types = deviceTypes(node, endpoint);
  if (types.includes(THERMOSTAT_TYPE) || hasCluster(node, endpoint, Cluster.Thermostat)) return "thermostat";
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

export function mapMatterNode(integrationId: string, node: MatterNode): Device[] {
  const nodeId = String(node.node_id);
  const nodeName = str(attribute(node, 0, Cluster.BasicInformation, 5)) ?? str(attribute(node, 0, Cluster.BasicInformation, 3)) ?? `Matter device ${nodeId}`;
  const devices: Device[] = [];

  for (const endpoint of endpointsOf(node)) {
    const kind = classifyEndpoint(node, endpoint);
    if (!kind) continue;
    const base = {
      id: deviceId(integrationId, matterNativeId(nodeId, endpoint)),
      integrationId,
      name: str(attribute(node, endpoint, Cluster.BridgedBasicInformation, 5)) ?? str(attribute(node, endpoint, Cluster.BridgedBasicInformation, 3)) ?? nodeName,
      available: node.available,
    };
    const on = attribute(node, endpoint, Cluster.OnOff, 0) === true;

    if (kind === "light") {
      const level = num(attribute(node, endpoint, Cluster.LevelControl, 0));
      devices.push({ ...base, kind, on, dimmable: hasCluster(node, endpoint, Cluster.LevelControl), brightness: on && level !== null ? Math.round(level / 254 * 100) : 0 });
    } else if (kind === "switch") {
      devices.push({ ...base, kind, on });
    } else if (kind === "fan") {
      const mode = num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.FanMode));
      const percent = num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentCurrent)) ?? num(attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentSetting));
      const fanOn = mode !== null ? mode !== 0 : (percent ?? 0) > 0;
      devices.push({ ...base, kind, on: fanOn, adjustable: attribute(node, endpoint, Cluster.FanControl, FanAttribute.PercentSetting) !== undefined, speed: fanOn ? percent || 100 : 0 });
    } else {
      devices.push(mapThermostat(base, node, endpoint));
    }
  }

  const seen = new Map<string, number>();
  return devices.map(device => {
    const count = (seen.get(device.name) ?? 0) + 1;
    seen.set(device.name, count);
    return count > 1 ? { ...device, name: `${device.name} ${count}` } : device;
  });
}

function mapThermostat(base: Pick<Device, "id" | "integrationId" | "name" | "available">, node: MatterNode, endpoint: number): Device {
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
