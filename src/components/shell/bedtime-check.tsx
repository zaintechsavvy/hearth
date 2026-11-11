"use client";

import { Check, Moon, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { useHome } from "@/components/dashboard/use-home";
import { glassSheetClass } from "@/components/glass/glass";
import { bedtimeChosen, bedtimePlan, bedtimeSteps, type BedtimeResult } from "@/lib/bedtime";
import { haptic } from "@/lib/haptics";
import { markSent } from "@/lib/sent-here";
import styles from "./bedtime-check.module.css";

const BEDTIME_EVENT = "hearth-bedtime";
/** Opens the good night check from anywhere: the wall tablet's clock and menu, or search. */
export const startBedtime = () => window.dispatchEvent(new Event(BEDTIME_EVENT));

type State = { kind: "idle" } | { kind: "confirm" } | { kind: "running" } | { kind: "done"; result: BedtimeResult } | { kind: "error"; message: string };

/**
 * Good night: says what it is about to do and what needs a look, runs once held like opening a lock, then lists
 * anything that did not listen. What it does is set in Settings.
 */
export function BedtimeCheck() {
  const { mutate } = useSWRConfig();
  const { home } = useHome();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const unset = home ? !bedtimeChosen(home.bedtime) : false;
  const steps = home ? bedtimeSteps(home.devices, home.bedtime) : [];
  const plan = bedtimePlan(steps);
  const looks = steps.filter(step => !step.command);

  const run = async () => {
    setState({ kind: "running" });
    markSent(...steps.map(step => step.deviceId));
    try {
      const response = await fetch("/api/bedtime", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Hearth could not run the good night check.");
      const result = body as BedtimeResult;
      haptic(result.failed.length ? "press" : "success");
      setState({ kind: "done", result });
      void mutate("/api/home");
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Hearth could not run the good night check." });
    }
  };

  useEffect(() => {
    const onStart = () => setState({ kind: "confirm" });
    window.addEventListener(BEDTIME_EVENT, onStart);
    return () => window.removeEventListener(BEDTIME_EVENT, onStart);
  }, []);

  const result = state.kind === "done" ? state.result : null;
  const title = state.kind === "confirm" && unset ? "Choose what good night does"
    : state.kind === "confirm" ? (plan ? "Good night?" : "Already set for the night")
    : state.kind === "running" ? "Getting the home ready for the night"
      : state.kind === "error" ? "The good night check did not run"
        : result && result.failed.length ? "Almost set for the night"
          : result && result.done.length === 0 ? "Already set for the night" : "All set for the night";
  const description = state.kind === "confirm" && unset ? "Pick the doors to lock, the lights to turn off, and anything else, and one hold of Good night does them all."
    : state.kind === "confirm" ? plan ?? (looks.length ? "Nothing to lock, close, or turn off. A few things need a look." : "Everything is locked, closed, and off.")
    : state.kind === "running" ? undefined : "Change what good night does in Settings, under Good night.";
  const failed = state.kind === "confirm" ? looks.map(step => ({ name: step.name, why: step.skip ?? "" })) : result?.failed ?? [];
  return (
    <Dialog open={state.kind !== "idle"} onOpenChange={open => !open && setState({ kind: "idle" })}>
      <DialogContent className={glassSheetClass} title={title} description={description}>
        <div className={styles.body}>
          {state.kind === "running" && <TextShimmer className={styles.working}>Locking up</TextShimmer>}
          {state.kind === "error" && <p className={styles.failed}>{state.message}</p>}
          {failed.length > 0 && (
            <ul className={styles.list} aria-label="What needs a look">
              {failed.map(item => (
                <li key={item.name} className={styles.row} data-failed>
                  <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span><b>{item.name}</b> {item.why}</span>
                </li>
              ))}
            </ul>
          )}
          {result && result.done.length > 0 && (
            <ul className={styles.list} aria-label="What Hearth did">
              {result.done.map(item => (
                <li key={item.name} className={styles.row}>
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span><b>{item.name}</b> {item.what}</span>
                </li>
              ))}
            </ul>
          )}
          {result && result.done.length === 0 && result.failed.length === 0 && <p className={styles.quiet}>Everything was already locked, closed, and off.</p>}
          {state.kind === "confirm" && unset && (
            <div className={styles.actions}>
              <DialogClose asChild><Button variant="ghost">Not now</Button></DialogClose>
              <Button onClick={() => { setState({ kind: "idle" }); router.push("/settings#bedtime"); }} autoFocus><Moon size={16} strokeWidth={1.75} aria-hidden="true" />Set up good night</Button>
            </div>
          )}
          {state.kind === "confirm" && !unset && (
            <div className={styles.actions}>
              <DialogClose asChild><Button variant="ghost">{plan ? "Cancel" : "Done"}</Button></DialogClose>
              {plan && <HoldToConfirm label="Hold for good night" confirmedLabel="Good night" tone="neutral" duration={1000} icon={<Moon size={18} strokeWidth={1.75} />} onConfirm={() => void run()} autoFocus />}
            </div>
          )}
          {state.kind !== "running" && state.kind !== "confirm" && (
            <div className={styles.actions}>
              {(state.kind === "error" || (result && result.failed.length > 0)) && <Button variant="ghost" onClick={() => void run()}>Try again</Button>}
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
