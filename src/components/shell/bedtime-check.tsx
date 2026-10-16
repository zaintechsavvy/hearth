"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { glassSheetClass } from "@/components/glass/glass";
import type { BedtimeResult } from "@/lib/bedtime";
import styles from "./bedtime-check.module.css";

const BEDTIME_EVENT = "hearth-bedtime";
/** Runs the bedtime check from anywhere: the wall tablet's clock and menu, or search. */
export const startBedtime = () => window.dispatchEvent(new Event(BEDTIME_EVENT));

type State = { kind: "idle" } | { kind: "running" } | { kind: "done"; result: BedtimeResult } | { kind: "error"; message: string };

/** One tap for the night: locks, garage doors, lights, and the alarm, then a short list of anything that did not listen. */
export function BedtimeCheck() {
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = async () => {
    setState({ kind: "running" });
    try {
      const response = await fetch("/api/bedtime", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Hearth could not run the bedtime check.");
      setState({ kind: "done", result: body as BedtimeResult });
      void mutate("/api/home");
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Hearth could not run the bedtime check." });
    }
  };

  useEffect(() => {
    const onStart = () => void run();
    window.addEventListener(BEDTIME_EVENT, onStart);
    return () => window.removeEventListener(BEDTIME_EVENT, onStart);
  });

  const result = state.kind === "done" ? state.result : null;
  const title = state.kind === "running" ? "Getting the home ready for the night"
    : state.kind === "error" ? "The bedtime check did not run"
      : result && result.failed.length ? "Almost set for the night"
        : result && result.done.length === 0 ? "Already set for the night" : "All set for the night";
  return (
    <Dialog open={state.kind !== "idle"} onOpenChange={open => !open && setState({ kind: "idle" })}>
      <DialogContent className={glassSheetClass} title={title} description={state.kind === "running" ? undefined : "Doors locked, garage closed, lights off, and the alarm on."}>
        <div className={styles.body}>
          {state.kind === "running" && <TextShimmer className={styles.working}>Locking up</TextShimmer>}
          {state.kind === "error" && <p className={styles.failed}>{state.message}</p>}
          {result && result.failed.length > 0 && (
            <ul className={styles.list} aria-label="What did not listen">
              {result.failed.map(item => (
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
          {state.kind !== "running" && (
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
