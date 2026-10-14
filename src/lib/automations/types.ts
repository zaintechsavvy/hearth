import { z } from "zod";
import { deviceCommandSchema } from "@/lib/devices/command-schema";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const days = z.array(z.number().int().min(0).max(6)).max(7).default([]);

/** What a device should be: on, open, locked, a reading above a value, and so on. */
export const stateMatch = z.discriminatedUnion("is", [
  z.object({ is: z.enum(["on", "off", "open", "closed", "locked", "unlocked", "active", "clear", "rang", "offline"]) }),
  z.object({ is: z.enum(["above", "below"]), value: z.number().min(-1000).max(100_000) }),
]);

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("time"), at: clock, days }),
  z.object({ type: z.literal("sun"), event: z.enum(["sunrise", "sunset"]), offset: z.number().int().min(-240).max(240), days }),
  z.object({ type: z.literal("device"), deviceId: z.string().min(1).max(300), match: stateMatch, forMinutes: z.number().int().min(0).max(1440).default(0) }),
]);

export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("time"), after: clock, before: clock }),
  z.object({ type: z.literal("sun"), when: z.enum(["day", "night"]) }),
  z.object({ type: z.literal("device"), deviceId: z.string().min(1).max(300), match: stateMatch }),
]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("device"), deviceId: z.string().min(1).max(300), command: deviceCommandSchema }),
  z.object({ type: z.literal("scene"), sceneId: z.string().min(1).max(100) }),
  z.object({ type: z.literal("notify"), title: z.string().trim().min(1).max(80), body: z.string().trim().max(200).default("") }),
]);

export const automationInput = z.object({
  name: z.string().trim().min(1, "Give the automation a name.").max(60),
  enabled: z.boolean().default(true),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(6).default([]),
  actions: z.array(actionSchema).min(1, "Add at least one thing to do.").max(12),
});

export type StateMatch = z.infer<typeof stateMatch>;
export type Trigger = z.infer<typeof triggerSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type AutomationInput = z.infer<typeof automationInput>;

export interface Automation extends AutomationInput {
  id: string;
  lastRun: string | null;
  snoozedUntil: string | null;
}

export interface HomeLocation {
  name: string;
  latitude: number;
  longitude: number;
}
