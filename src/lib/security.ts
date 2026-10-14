import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SecuritySettings } from "./security-types";

const MAX_TRIES = 5;
const LOCKOUT_MS = 5 * 60_000;
const tries = (globalThis as unknown as { hearthPinTries?: Map<string, { failed: number; until: number }> }).hearthPinTries ??= new Map();

export function hashPin(pin: string): Pick<SecuritySettings, "salt" | "hash"> {
  const salt = randomBytes(16).toString("base64");
  return { salt, hash: scryptSync(pin, salt, 32).toString("base64") };
}

/**
 * Checks a PIN for a home. After five wrong tries that home's PIN is locked for five minutes, so a code cannot be
 * guessed from the dashboard.
 */
export function checkPin(homeId: string, settings: SecuritySettings, pin: string | null): "ok" | "wrong" | "locked" | "missing" {
  const state = tries.get(homeId);
  if (state && state.until > Date.now()) return "locked";
  if (!pin) return "missing";
  if (!settings.salt || !settings.hash) return "wrong";
  const expected = Buffer.from(settings.hash, "base64");
  const given = scryptSync(pin, settings.salt, expected.length);
  if (timingSafeEqual(given, expected)) {
    tries.delete(homeId);
    return "ok";
  }
  const failed = (state?.failed ?? 0) + 1;
  tries.set(homeId, { failed: failed >= MAX_TRIES ? 0 : failed, until: failed >= MAX_TRIES ? Date.now() + LOCKOUT_MS : 0 });
  return "wrong";
}
