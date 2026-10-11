import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assistant } from "@/lib/db/schema";
import { loadHome, readableError, runCommand } from "@/lib/home";
import { ASSISTANT_PROVIDERS } from "./providers";
import { runAssistant, type ChatTurn } from "./run";
import { parseToolInput, systemPrompt, toCommand } from "./tools";

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
};

export async function askAssistant(userId: string, history: ChatTurn[]) {
  const row = await defaultAssistant(userId);
  if (!row) return null;
  const home = await loadHome(userId);
  const devices = new Map(home.devices.map(device => [device.id, device]));
  const actions: AssistantAction[] = [];

  const callTool = async (raw: unknown) => {
    const input = parseToolInput(raw);
    if (typeof input === "string") return input;
    const device = devices.get(input.device_id);
    if (!device) return `There is no device with id ${input.device_id}. Use an id from the device list.`;
    const command = toCommand(device, input);
    if (typeof command === "string") return command;
    try {
      await runCommand(userId, device.id, command);
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
    system: systemPrompt(home.devices),
    history,
    callTool,
  });
  return { reply, actions, provider: ASSISTANT_PROVIDERS[row.provider].label };
}

export async function assistantFor(userId: string, id: string) {
  return db.query.assistant.findFirst({ where: and(eq(assistant.id, id), eq(assistant.userId, userId)) });
}
