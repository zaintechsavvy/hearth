"use client";

import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { haptic } from "@/lib/haptics";
import styles from "./pin-pad.module.css";

interface PinPadProps {
  /** What the code is for, read to screen readers, such as "Household PIN". */
  label: string;
  submitLabel: string;
  /** Sends the code; resolves to an error to show, or null once it worked. */
  onSubmit: (code: string) => Promise<string | null>;
  /** Letters as well as digits, for alarms with a text code. */
  text?: boolean;
  /** How many digits the code has, when known: it is sent as soon as the last one is typed, with no button to press. */
  length?: number | null;
  /** Sizes the keys to the space it is given, for a keypad laid into a tile instead of a dialog. */
  fill?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** A phone-style keypad: dots for what is typed, big keys, and a typed keyboard works too. */
export function PinPad({ label, submitLabel, onSubmit, text = false, length = null, fill = false }: PinPadProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (value = code) => {
    if (!value || pending) return;
    setPending(true);
    const problem = await onSubmit(value);
    setPending(false);
    if (problem) {
      haptic("alert");
      setError(problem);
      setCode("");
    }
  };
  const press = (key: string) => {
    if (pending) return;
    setError(null);
    const next = (code + key).slice(0, length ?? 12);
    setCode(next);
    if (length && next.length === length) void submit(next);
  };
  const back = () => { if (!pending) setCode(current => current.slice(0, -1)); };

  useEffect(() => {
    if (text) return;
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") back();
      else if (event.key === "Enter") void submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={styles.pad} data-error={error ? "" : undefined} data-fill={fill || undefined}>
      {text ? (
        <input className={styles.text} type="password" aria-label={label} value={code} autoFocus onChange={event => { setError(null); setCode(event.target.value); }} onKeyDown={event => { if (event.key === "Enter") void submit(); }} />
      ) : (
        <div className={styles.dots} role="status" aria-label={`${label}, ${code.length} digits entered`}>
          {Array.from({ length: length ?? Math.max(4, code.length) }, (_, index) => <span key={index} className={styles.dot} data-on={index < code.length || undefined} />)}
        </div>
      )}
      <p className={styles.message} data-checking={pending || undefined} aria-live="assertive">{pending ? "Checking" : error ?? " "}</p>
      {!text && (
        <div className={styles.keys}>
          {KEYS.map(key => <button key={key} type="button" className={styles.key} disabled={pending} onClick={() => press(key)}>{key}</button>)}
          <span />
          <button type="button" className={styles.key} disabled={pending} onClick={() => press("0")}>0</button>
          <button type="button" className={`${styles.key} ${styles.quiet}`} disabled={pending} aria-label="Delete" onClick={back}><Delete size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
      )}
      {(text || !length) && <Button className={styles.submit} disabled={!code} loading={pending} onClick={() => void submit()}>{submitLabel}</Button>}
    </div>
  );
}
