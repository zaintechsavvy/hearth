import "server-only";
import type { z } from "zod";
import { readableError } from "@/lib/home";
import { publish, userTopic } from "@/lib/live/bus";
import { atLeast, type HomeAccess, type Role } from "@/lib/household";
import { getHome } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreatedResult = { ok: true; id: string } | { ok: false; error: string };

export const OK: ActionResult = { ok: true };

/**
 * Runs an action in the signed-in person's home, given its id, then tells every live dashboard in that home to
 * refresh. Guests can run none by default; pass the lowest role the action allows.
 */
export async function authed(run: (homeId: string, access: HomeAccess) => Promise<ActionResult>, role: Role = "member"): Promise<ActionResult> {
  const home = await getHome();
  if (!home) return { ok: false, error: "Your session ended. Sign in again." };
  if (!atLeast(home.role, role)) return { ok: false, error: role === "owner" ? `Only ${home.ownerName} can change this.` : "Guests cannot change this." };
  try {
    const result = await run(home.homeId, home);
    if (result.ok) publish(userTopic(home.homeId));
    return result;
  } catch (error) {
    return { ok: false, error: readableError(error) };
  }
}

/** For actions only the home's owner may take, checked before anything else runs. */
export async function ownerOnly(): Promise<{ ok: false; error: string } | null> {
  const home = await getHome();
  if (!home) return { ok: false, error: "Your session ended. Sign in again." };
  return home.role === "owner" ? null : { ok: false, error: `Only ${home.ownerName} can change connections, cameras, and assistants.` };
}

export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form and try again.";
