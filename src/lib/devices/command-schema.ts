import { z } from "zod";

const mode = z.enum(["off", "heat", "cool", "auto", "dry", "fan"]);

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
  z.object({ type: z.literal("shuffle"), on: z.boolean() }),
  z.object({ type: z.literal("repeat"), mode: z.enum(["off", "all", "one"]) }),
  z.object({ type: z.literal("join"), members: z.array(z.string().min(1).max(300)).min(1).max(20) }),
  z.object({ type: z.literal("unjoin") }),
  z.object({ type: z.literal("playMedia"), id: z.string().min(1).max(500), mediaType: z.string().min(1).max(60) }),
  z.object({ type: z.literal("announce"), message: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal("vacuum"), action: z.enum(["start", "pause", "stop", "dock", "locate"]) }),
  z.object({ type: z.literal("alarm"), action: z.enum(["arm", "disarm"]), mode: z.enum(["home", "away", "night", "vacation"]).optional(), code: z.string().max(40).optional() }),
  z.object({ type: z.literal("todo"), action: z.enum(["add", "check", "uncheck", "remove"]), item: z.string().trim().min(1).max(300) }),
]);
