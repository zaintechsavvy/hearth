import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assistant } from "@/lib/db/schema";
import { loadHome, readableError, runCommand, runScene } from "@/lib/home";
import { saveScene } from "@/lib/scenes/service";
import { ASSISTANT_PROVIDERS } from "./providers";
import { runAssistant, type ChatTurn } from "./run";
import { parseSceneCreate, parseSceneRun, parseToolInput, systemPrompt, toCommand } from "./tools";

export interface AssistantAction {
  deviceId: string;
  name: string;
  summary: string;
  ok: boolean;
}

export async function defaultAssistant(userId: string) {
  const [row] = await db.select().from(assistant).where(eq(assistant.userId, userId)).orderBy(desc(assistant.isDefault), assistant.createdAt).limit(1);
  return row ?? null;
}

const SUMMARIES: Record<string, (value?: number, mode?: string) => string> = {
  turn_on: () => "On",
  turn_off: () => "Off",
  set_brightness: value => `${value}%`,
  set_fan_speed: value => `Speed ${value}%`,
  set_temperature: value => `Set to ${value}°`,
  set_mode: (_, mode) => `Mode ${mode}`,
  lock: () => "Locked",
  unlock: () => "Unlocked",
  open: () => "Opening",
  close: () => "Closing",
  stop: () => "Stopped",
  set_position: value => `${value}% open`,
  activate: () => "Ran",
  play: () => "Playing",
  pause: () => "Paused",
  next_track: () => "Next track",
  previous_track: () => "Previous track",
  set_volume: value => `Volume ${value}%`,
  set_output: () => "Output changed",
};

export async function askAssistant(userId: string, history: ChatTurn[]) {
  const row = await defaultAssistant(userId);
  if (!row) return null;
  const home = await loadHome(userId);
  const devices = new Map(home.devices.map(device => [device.id, device]));
  const actions: AssistantAction[] = [];

  const scenes = new Map(home.scenes.map(scene => [scene.id, scene]));

  const runSavedScene = async (raw: unknown) => {
    const input = parseSceneRun(raw);
    if (typeof input === "string") return input;
    const scene = scenes.get(input.scene_id.replace(/^scene:/, ""));
    if (!scene) return `There is no scene with id ${input.scene_id}.`;
    const result = await runScene(userId, scene.id);
    if (!result) return "That scene no longer exists.";
    actions.push({ deviceId: `scene:${scene.id}`, name: scene.name, summary: result.failed.length ? `${result.failed.length} failed` : "Ran", ok: result.failed.length === 0 });
    return result.failed.length ? `Ran ${result.ran} steps. These failed: ${result.failed.map(item => `${item.name} (${item.error})`).join("; ")}` : `Ran all ${result.ran} steps.`;
  };

  const createSavedScene = async (raw: unknown) => {
    const input = parseSceneCreate(raw);
    if (typeof input === "string") return input;
    const steps = [];
    for (const step of input.devices) {
      const device = devices.get(step.device_id);
      if (!device) return `There is no device with id ${step.device_id}.`;
      const command = toCommand(device, step);
      if (typeof command === "string") return command;
      steps.push({ deviceId: device.id, command });
    }
    const saved = await saveScene(userId, { name: input.name, icon: "clapperboard", actions: steps });
    if (!saved.ok) return saved.error;
    actions.push({ deviceId: `scene:${saved.id}`, name: input.name, summary: "Scene saved", ok: true });
    return `Saved the scene ${input.name} (id ${saved.id}) with ${steps.length} steps. It appears on the dashboard.`;
  };

  const callTool = async (name: string, raw: unknown) => {
    if (name === "run_scene") return runSavedScene(raw);
    if (name === "create_scene") return createSavedScene(raw);
    if (name !== "control_device") return `There is no tool called ${name}.`;
    const input = parseToolInput(raw);
    if (typeof input === "string") return input;
    const device = devices.get(input.device_id);
    if (!device) return `There is no device with id ${input.device_id}. Use an id from the device list.`;
    const command = toCommand(device, input);
    if (typeof command === "string") return command;
    try {
      await runCommand(userId, device.id, command, "the assistant");
      actions.push({ deviceId: device.id, name: device.name, summary: SUMMARIES[input.action](input.value, input.mode), ok: true });
      return `Done. ${device.name} accepted ${input.action}${input.value !== undefined ? ` ${input.value}` : ""}${input.mode ? ` ${input.mode}` : ""}.`;
    } catch (error) {
      const message = readableError(error);
      actions.push({ deviceId: device.id, name: device.name, summary: "Failed", ok: false });
      return `That failed: ${message}`;
    }
  };

  const reply = await runAssistant({
    provider: row.provider,
    model: row.model,
    apiKey: unseal<string>(row.apiKey),
    baseUrl: row.baseUrl,
    system: systemPrompt(home.devices, home.scenes),
    history,
    callTool,
  });
  return { reply, actions, provider: ASSISTANT_PROVIDERS[row.provider].label };
}

export async function assistantFor(userId: string, id: string) {
  return db.query.assistant.findFirst({ where: and(eq(assistant.id, id), eq(assistant.userId, userId)) });
}
