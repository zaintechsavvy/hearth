import { hsToXy, kelvinToMired } from "@/lib/devices/color";
import { clamp, type DeviceCommand, type ThermostatDevice } from "@/lib/devices/types";
import { IntegrationError, countBy, type DeviceList, type Provider } from "../types";
import { matterClient, wireNodeId, type MatterNode } from "./client";
import { Cluster, ColorAttribute, ColorCapability, FanAttribute, SYSTEM_MODE, ThermostatAttribute, attribute, hasCluster, mapMatterNode, parseMatterNativeId } from "./mapping";

interface WriteResult {
  Path: { EndpointId: number; ClusterId: number; AttributeId: number };
  Status: number;
}

const FAN_MODE = { off: 0, on: 4 };
const COMMISSION_TIMEOUT_MS = 180_000;
const TIMED_INVOKE_MS = 10_000;

export class MatterProvider implements Provider {
  constructor(private readonly integrationId: string, private readonly config: { url: string }) {}

  private get client() {
    return matterClient(this.config.url);
  }

  async check() {
    await this.client.connect();
  }

  subscribe(onChange: () => void) {
    return this.client.subscribe(onChange);
  }

  async listDevices(): Promise<DeviceList> {
    const mapped = (await this.client.getNodes()).map(node => mapMatterNode(this.integrationId, node, this.client.lastEvents));
    return { devices: mapped.flatMap(node => node.devices), unsupported: countBy(mapped.flatMap(node => node.unsupported)) };
  }

  async execute(nativeId: string, command: DeviceCommand) {
    const { nodeId, endpoint } = parseMatterNativeId(nativeId);
    const node = await this.client.getNode(nodeId);
    if (!node) throw new IntegrationError("This device is no longer paired with the Matter server.");
    const thermostat = hasCluster(node, endpoint, Cluster.Thermostat);

    switch (command.type) {
      case "power":
        if (thermostat) {
          const device = this.thermostat(node, nativeId);
          return this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.SystemMode, command.on ? SYSTEM_MODE[device.modes.find(mode => mode !== "off") ?? "heat"] : SYSTEM_MODE.off);
        }
        if (hasCluster(node, endpoint, Cluster.FanControl)) return this.write(nodeId, endpoint, Cluster.FanControl, FanAttribute.FanMode, command.on ? FAN_MODE.on : FAN_MODE.off);
        return this.invoke(nodeId, endpoint, Cluster.OnOff, command.on ? "On" : "Off");
      case "brightness":
        if (command.value <= 0) return this.invoke(nodeId, endpoint, Cluster.OnOff, "Off");
        return this.invoke(nodeId, endpoint, Cluster.LevelControl, "MoveToLevelWithOnOff", {
          level: clamp(Math.round(command.value / 100 * 254), 1, 254),
          transitionTime: 4,
          optionsMask: 0,
          optionsOverride: 0,
        });
      case "color": {
        const capabilities = Number(attribute(node, endpoint, Cluster.ColorControl, ColorAttribute.Capabilities) ?? 0);
        if (!(capabilities & ColorCapability.HueSaturation)) {
          const { x, y } = hsToXy(command);
          return this.invoke(nodeId, endpoint, Cluster.ColorControl, "MoveToColor", { colorX: Math.round(x * 65536), colorY: Math.round(y * 65536), transitionTime: 4, optionsMask: 0, optionsOverride: 0 });
        }
        return this.invoke(nodeId, endpoint, Cluster.ColorControl, "MoveToHueAndSaturation", {
          hue: clamp(Math.round(command.hue / 360 * 254), 0, 254),
          saturation: clamp(Math.round(command.saturation / 100 * 254), 0, 254),
          transitionTime: 4,
          optionsMask: 0,
          optionsOverride: 0,
        });
      }
      case "temperature":
        return this.invoke(nodeId, endpoint, Cluster.ColorControl, "MoveToColorTemperature", {
          colorTemperatureMireds: kelvinToMired(command.kelvin),
          transitionTime: 4,
          optionsMask: 0,
          optionsOverride: 0,
        });
      case "fanSpeed":
        return this.write(nodeId, endpoint, Cluster.FanControl, FanAttribute.PercentSetting, clamp(Math.round(command.value), 0, 100));
      case "targetTemperature":
        return this.setTarget(node, nativeId, command.value);
      case "thermostatMode":
        return this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.SystemMode, SYSTEM_MODE[command.mode]);
      case "lock":
        return this.invoke(nodeId, endpoint, Cluster.DoorLock, command.locked ? "LockDoor" : "UnlockDoor", {}, TIMED_INVOKE_MS);
      case "cover":
        return this.invoke(nodeId, endpoint, Cluster.WindowCovering, command.action === "open" ? "UpOrOpen" : command.action === "close" ? "DownOrClose" : "StopMotion");
      case "coverPosition":
        return this.invoke(nodeId, endpoint, Cluster.WindowCovering, "GoToLiftPercentage", { liftPercent100thsValue: Math.round((100 - clamp(command.value, 0, 100)) * 100) });
      case "activate":
        throw new IntegrationError("Matter devices have no scenes to run.");
    }
  }

  /** Pairs a device from its setup code. Codes shared from another ecosystem only need the network; new devices need Bluetooth on the server. */
  async commission(code: string): Promise<MatterNode> {
    await this.client.connect();
    const networkOnly = !this.client.info?.bluetooth_enabled;
    return this.client.request<MatterNode>("commission_with_code", { code, network_only: networkOnly }, COMMISSION_TIMEOUT_MS);
  }

  private thermostat(node: MatterNode, nativeId: string) {
    const device = mapMatterNode(this.integrationId, node).devices.find(item => item.id.endsWith(`:${nativeId}`));
    if (device?.kind !== "thermostat") throw new IntegrationError("This Matter device is not a thermostat.");
    return device;
  }

  /** Auto keeps the deadband: heating and cooling setpoints move together. */
  private async setTarget(node: MatterNode, nativeId: string, value: number) {
    const { nodeId, endpoint } = parseMatterNativeId(nativeId);
    const device: ThermostatDevice = this.thermostat(node, nativeId);
    const centi = (celsius: number) => Math.round(clamp(celsius, device.min, device.max) * 100);
    if (device.mode === "cool") return this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.OccupiedCooling, centi(value));
    if (device.mode === "auto" && device.target !== null) {
      const shift = value - device.target;
      const heating = node.attributes[`${endpoint}/${Cluster.Thermostat}/${ThermostatAttribute.OccupiedHeating}`] as number;
      const cooling = node.attributes[`${endpoint}/${Cluster.Thermostat}/${ThermostatAttribute.OccupiedCooling}`] as number;
      await this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.OccupiedHeating, Math.round(heating + shift * 100));
      return this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.OccupiedCooling, Math.round(cooling + shift * 100));
    }
    return this.write(nodeId, endpoint, Cluster.Thermostat, ThermostatAttribute.OccupiedHeating, centi(value));
  }

  /** Door locks only accept commands inside a timed interaction, so those pass a timeout. */
  private async invoke(nodeId: string, endpoint: number, cluster: number, command: string, payload: Record<string, unknown> = {}, timedMs?: number) {
    await this.client.request("device_command", {
      node_id: wireNodeId(nodeId), endpoint_id: endpoint, cluster_id: cluster, command_name: command, payload,
      ...(timedMs ? { timed_request_timeout_ms: timedMs } : {}),
    });
  }

  /** A rejected write still arrives as a success envelope, so the per-path status is checked here. */
  private async write(nodeId: string, endpoint: number, cluster: number, attribute: number, value: unknown) {
    const results = await this.client.request<WriteResult[] | null>("write_attribute", { node_id: wireNodeId(nodeId), attribute_path: `${endpoint}/${cluster}/${attribute}`, value });
    const failed = results?.find(result => result.Status !== 0);
    if (failed) throw new IntegrationError(`The device refused the change (Matter status ${failed.Status}).`);
  }
}

