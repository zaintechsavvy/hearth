import { z } from "zod";

const mode = z.enum(["off", "heat", "cool", "auto"]);

export const deviceCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("power"), on: z.boolean() }),
  z.object({ type: z.literal("brightness"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("fanSpeed"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("targetTemperature"), value: z.number().min(-20).max(120) }),
  z.object({ type: z.literal("thermostatMode"), mode }),
]);
