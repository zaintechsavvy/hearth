import { z } from "zod";
import type { Device, DeviceCommand } from "@/lib/devices/types";
import { describeState } from "./describe";

export const CONTROL_TOOL = {
  name: "control_device",
  description: "Change one device. To change several devices, call it once for each.",
  parameters: {
    type: "object",
    properties: {
      device_id: { type: "string", description: "The device id, exactly as it appears in the device list." },
      action: { type: "string", enum: ["turn_on", "turn_off", "set_brightness", "set_fan_speed", "set_temperature", "set_mode"] },
      value: { type: "number", description: "Brightness or fan speed from 0 to 100, or a target temperature in the thermostat's own unit." },
      mode: { type: "string", enum: ["off", "heat", "cool", "auto"], description: "The thermostat mode, for set_mode." },
    },
    required: ["device_id", "action"],
    additionalProperties: false,
  },
} as const;

const toolInput = z.object({
  device_id: z.string(),
  action: z.enum(["turn_on", "turn_off", "set_brightness", "set_fan_speed", "set_temperature", "set_mode"]),
  value: z.number().optional(),
  mode: z.enum(["off", "heat", "cool", "auto"]).optional(),
});

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
  switch (input.action) {
    case "turn_on":
      return { type: "power", on: true };
    case "turn_off":
      return { type: "power", on: false };
    case "set_brightness":
      if (device.kind !== "light" || !device.dimmable) return `${device.name} cannot be dimmed.`;
      return input.value === undefined ? "set_brightness needs a value from 0 to 100." : { type: "brightness", value: Math.max(0, Math.min(100, input.value)) };
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
  }
}

export function systemPrompt(devices: Device[]) {
  const list = devices.length
    ? devices.map(device => `- id ${device.id} | ${device.name} | ${device.room ?? "no room"} | ${device.kind} | ${describeState(device)}`).join("\n")
    : "(no devices are connected yet)";
  return `You are the assistant inside Hearth, a home dashboard. You change devices with the control_device tool.

Act on clear requests straight away, without asking for permission. Match devices by name and room. When the person means a group, such as "all the kitchen lights", change each matching device. If a request could mean more than one device and nothing says which, ask one short question instead of guessing.

Temperatures use each thermostat's own unit. After acting, reply in one short sentence that says what changed. If a device refuses or a request is outside what the tool can do, say so plainly.

Devices right now:
${list}`;
}
