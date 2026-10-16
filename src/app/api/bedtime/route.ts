import { NextResponse } from "next/server";
import { bedtimeSteps, type BedtimeResult } from "@/lib/bedtime";
import { loadHome, readableError, runCommand } from "@/lib/home";
import { getHome } from "@/lib/session";

const STEP_TIMEOUT_MS = 12_000;

/** Runs a bedtime check on the home and says what worked and what did not. */
export async function POST() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot do this." }, { status: 403 });
  const steps = bedtimeSteps((await loadHome(home.homeId)).devices);
  const by = `${home.user.name}'s bedtime check`;
  const outcomes = await Promise.all(steps.map(async step => {
    if (!step.command) return { step, error: step.skip ?? "was skipped" };
    try {
      await Promise.race([
        runCommand(home.homeId, step.deviceId, step.command, by),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("did not answer in time")), STEP_TIMEOUT_MS)),
      ]);
      return { step, error: null };
    } catch (error) {
      return { step, error: error instanceof Error && error.message === "did not answer in time" ? error.message : readableError(error) };
    }
  }));
  const result: BedtimeResult = {
    done: outcomes.filter(outcome => !outcome.error).map(({ step }) => ({ name: step.name, what: step.done })),
    failed: outcomes.flatMap(({ step, error }) => error ? [{ name: step.name, why: error }] : []),
  };
  return NextResponse.json(result);
}
