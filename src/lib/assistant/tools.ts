import { z } from "zod";
import { hexToHs } from "@/lib/devices/color";
import { isSensitive, type Device, type DeviceCommand } from "@/lib/devices/types";
import { describeState } from "./describe";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const CONTROL_TOOL = {
  name: "control_device",
  description: "Change one device. To change several devices, call it once for each.",
  parameters: {
    type: "object",
    properties: {
      device_id: { type: "string", description: "The device id, exactly as it appears in the device list." },
      action: { type: "string", enum: ["turn_on", "turn_off", "set_brightness", "set_color", "set_white", "set_fan_speed", "set_temperature", "set_mode", "lock", "unlock", "open", "close", "stop", "set_position", "activate", "play", "pause", "next_track", "previous_track", "set_volume", "set_output"] },
      value: { type: "number", description: "Brightness, fan speed, volume, or cover position (0 closed, 100 open) from 0 to 100; a target temperature in the thermostat's own unit; or, for set_white, a white temperature in kelvin (2700 warm, 4000 neutral, 6500 daylight)." },
      color: { type: "string", description: "For set_color, the colour as #rrggbb." },
      output: { type: "string", description: "For set_output, one of the media player's outputs, exactly as listed." },
      mode: { type: "string", enum: ["off", "heat", "cool", "auto"], description: "The thermostat mode, for set_mode." },
    },
    required: ["device_id", "action"],
    additionalProperties: false,
  },
} as const satisfies ToolSpec;

export const RUN_SCENE_TOOL = {
  name: "run_scene",
  description: "Run one of the person's saved Hearth scenes.",
  parameters: {
    type: "object",
    properties: { scene_id: { type: "string", description: "The scene id, exactly as it appears in the scene list." } },
    required: ["scene_id"],
    additionalProperties: false,
  },
} as const satisfies ToolSpec;

export const CREATE_SCENE_TOOL = {
  name: "create_scene",
  description: "Save a new Hearth scene that sets several devices at once. Only create one when the person asks for it.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "A short name, such as Movie night." },
      devices: {
        type: "array",
        description: "What each device should do when the scene runs.",
        items: CONTROL_TOOL.parameters,
      },
    },
    required: ["name", "devices"],
    additionalProperties: false,
  },
} as const satisfies ToolSpec;

export const ASSISTANT_TOOLS: ToolSpec[] = [CONTROL_TOOL, RUN_SCENE_TOOL, CREATE_SCENE_TOOL];

const sceneRun = z.object({ scene_id: z.string() });
const sceneCreate = z.object({ name: z.string().min(1).max(60), devices: z.array(toolInputShape()).min(1).max(100) });

function toolInputShape() {
  return z.object({
    device_id: z.string(),
    action: z.enum(["turn_on", "turn_off", "set_brightness", "set_color", "set_white", "set_fan_speed", "set_temperature", "set_mode", "lock", "unlock", "open", "close", "stop", "set_position", "activate", "play", "pause", "next_track", "previous_track", "set_volume", "set_output"]),
    value: z.number().optional(),
    color: z.string().optional(),
    output: z.string().optional(),
    mode: z.enum(["off", "heat", "cool", "auto"]).optional(),
  });
}

export function parseSceneRun(raw: unknown) {
  const parsed = sceneRun.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
  return parsed.success ? parsed.data : "Pass scene_id.";
}

export function parseSceneCreate(raw: unknown) {
  const parsed = sceneCreate.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
  return parsed.success ? parsed.data : "Pass a name and a devices list.";
}

const toolInput = toolInputShape();

export type ToolInput = z.infer<typeof toolInput>;

export function parseToolInput(raw: unknown): ToolInput | string {
  const parsed = toolInput.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
  return parsed.success ? parsed.data : "The tool input was not valid. Pass device_id and action.";
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Turns a tool call into a device command, or explains why it does not fit the device. */
export function toCommand(device: Device, input: ToolInput): DeviceCommand | string {
  const command = commandFor(device, input);
  if (typeof command !== "string" && isSensitive(device, command)) {
    return `For safety, ${device.name} can only be ${command.type === "lock" ? "unlocked" : "opened"} from the dashboard. Tell the person to do it there.`;
  }
  return command;
}

const TOGGLES = new Set(["light", "switch", "fan", "thermostat"]);

function commandFor(device: Device, input: ToolInput): DeviceCommand | string {
  switch (input.action) {
    case "turn_on":
    case "turn_off":
      if (device.kind === "cover") return { type: "cover", action: input.action === "turn_on" ? "open" : "close" };
      if (device.kind === "lock") return { type: "lock", locked: input.action === "turn_off" };
      if (device.kind === "scene" && input.action === "turn_on") return { type: "activate" };
      if (!TOGGLES.has(device.kind)) return `${device.name} cannot be switched on or off.`;
      return { type: "power", on: input.action === "turn_on" };
    case "lock":
    case "unlock":
      return device.kind === "lock" ? { type: "lock", locked: input.action === "lock" } : `${device.name} is not a lock.`;
    case "open":
    case "close":
    case "stop":
      if (device.kind !== "cover") return `${device.name} is not a door, gate, or blind.`;
      if (input.action === "stop" && !device.canStop) return `${device.name} cannot be stopped.`;
      return { type: "cover", action: input.action };
    case "set_position":
      if (device.kind !== "cover" || !device.canSetPosition) return `${device.name} does not take a position.`;
      return input.value === undefined ? "set_position needs a value from 0 to 100." : { type: "coverPosition", value: Math.max(0, Math.min(100, input.value)) };
    case "activate":
      return device.kind === "scene" ? { type: "activate" } : `${device.name} is not a scene, script, or button.`;
    case "set_brightness":
      if (device.kind !== "light" || !device.dimmable) return `${device.name} cannot be dimmed.`;
      return input.value === undefined ? "set_brightness needs a value from 0 to 100." : { type: "brightness", value: Math.max(0, Math.min(100, input.value)) };
    case "set_color": {
      if (device.kind !== "light" || !device.supportsColor) return `${device.name} does not take colours.`;
      const color = input.color ? hexToHs(input.color) : null;
      return color ? { type: "color", ...color } : "set_color needs a colour as #rrggbb.";
    }
    case "set_white":
      if (device.kind !== "light" || !device.temperatureRange) return `${device.name} has no white temperature control.`;
      return input.value === undefined ? `set_white needs a temperature from ${device.temperatureRange.min} to ${device.temperatureRange.max} kelvin.` : { type: "temperature", kelvin: input.value };
    case "set_fan_speed":
      if (device.kind !== "fan" || !device.adjustable) return `${device.name} has no speed control.`;
      return input.value === undefined ? "set_fan_speed needs a value from 0 to 100." : { type: "fanSpeed", value: Math.max(0, Math.min(100, input.value)) };
    case "set_temperature":
      if (device.kind !== "thermostat") return `${device.name} is not a thermostat.`;
      return input.value === undefined ? "set_temperature needs a value." : { type: "targetTemperature", value: input.value };
    case "set_mode":
      if (device.kind !== "thermostat") return `${device.name} is not a thermostat.`;
      if (!input.mode || !device.modes.includes(input.mode)) return `${device.name} supports these modes: ${device.modes.join(", ")}.`;
      return { type: "thermostatMode", mode: input.mode };
    case "play":
    case "pause":
    case "next_track":
    case "previous_track":
      if (device.kind !== "media_player") return `${device.name} is not a media player.`;
      return { type: "media", action: input.action === "next_track" ? "next" : input.action === "previous_track" ? "previous" : input.action };
    case "set_volume":
      if (device.kind !== "media_player" || !device.can.volume) return `${device.name} has no volume control.`;
      return input.value === undefined ? "set_volume needs a value from 0 to 100." : { type: "volume", value: Math.max(0, Math.min(100, input.value)) };
    case "set_output":
      if (device.kind !== "media_player" || !device.can.output) return `${device.name} cannot switch outputs.`;
      return input.output && device.outputs.includes(input.output) ? { type: "output", output: input.output } : `${device.name} can play on: ${device.outputs.join(", ")}.`;
  }
}

export function systemPrompt(devices: Device[], scenes: { id: string; name: string; actions: unknown[] }[] = []) {
  const sceneList = scenes.length ? scenes.map(scene => `- id ${scene.id} | ${scene.name} | ${scene.actions.length} steps`).join("\n") : "(no saved scenes)";
  const list = devices.length
    ? devices.map(device => `- id ${device.id} | ${device.name} | ${device.room ?? "no room"} | ${device.kind} | ${describeState(device)}`).join("\n")
    : "(no devices are connected yet)";
  return `You are the assistant inside Hearth, a home dashboard. You change devices with the control_device tool.

Act on clear requests straight away, without asking for permission. Match devices by name and room. When the person means a group, such as "all the kitchen lights", change each matching device. If a request could mean more than one device and nothing says which, ask one short question instead of guessing.

Temperatures use each thermostat's own unit. Sensors, doorbells, and cameras are read only: answer questions about them from the list. You can lock doors and close garage doors and gates, but unlocking and opening are left to the person, so say they can do it from the dashboard. After acting, reply in one short sentence that says what changed. If a device refuses or a request is outside what the tool can do, say so plainly.

Saved scenes run with run_scene. When the person asks for a scene, create it with create_scene using device ids from the list.

Devices right now:
${list}

Scenes:
${sceneList}`;
}
