import "server-only";
import type { z } from "zod";
import { readableError } from "@/lib/home";
import { publish, userTopic } from "@/lib/live/bus";
import { getUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreatedResult = { ok: true; id: string } | { ok: false; error: string };

export const OK: ActionResult = { ok: true };

/** Runs an action for the signed-in person, then tells their live dashboards to refresh. */
export async function authed(run: (userId: string) => Promise<ActionResult>): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Your session ended. Sign in again." };
  try {
    const result = await run(user.id);
    if (result.ok) publish(userTopic(user.id));
    return result;
  } catch (error) {
    return { ok: false, error: readableError(error) };
  }
}

export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form and try again.";
