import { z } from "zod";

const mode = z.enum(["off", "heat", "cool", "auto"]);

export const deviceCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("power"), on: z.boolean() }),
  z.object({ type: z.literal("brightness"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("color"), hue: z.number().min(0).max(360), saturation: z.number().min(0).max(100) }),
  z.object({ type: z.literal("temperature"), kelvin: z.number().min(1000).max(12_000) }),
  z.object({ type: z.literal("fanSpeed"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("targetTemperature"), value: z.number().min(-20).max(120) }),
  z.object({ type: z.literal("thermostatMode"), mode }),
  z.object({ type: z.literal("lock"), locked: z.boolean() }),
  z.object({ type: z.literal("cover"), action: z.enum(["open", "close", "stop"]) }),
  z.object({ type: z.literal("coverPosition"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("activate") }),
  z.object({ type: z.literal("media"), action: z.enum(["play", "pause", "next", "previous"]) }),
  z.object({ type: z.literal("seek"), position: z.number().min(0).max(86_400) }),
  z.object({ type: z.literal("volume"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("output"), output: z.string().min(1).max(200) }),
]);
