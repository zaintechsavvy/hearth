import { Check } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./spotify-section.module.css";

export type StepState = "done" | "current" | "next";

/** One numbered setup step: a done step shows a summary, the current one its controls, and a later one only its name. */
export function SetupStep({ number, title, state, summary, children }: { number: number; title: string; state: StepState; summary?: ReactNode; children?: ReactNode }) {
  return (
    <li className={styles.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
      <span className={styles.stepNumber} aria-hidden="true">{state === "done" ? <Check size={14} strokeWidth={2.25} /> : number}</span>
      <div className={styles.stepBody}>
        <span className={styles.stepTitle}>{title}{state === "done" && <span className={styles.visuallyHidden}>, done</span>}</span>
        {state === "done" && summary}
        {state === "current" && children}
      </div>
    </li>
  );
}
