"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

export const HOLD_MS = 1000;
/** A press shorter than this is a tap, which explains how to open instead of opening. */
const TAP_MS = 250;
const HINT_MS = 2000;
/** The click that ends a completed hold arrives after the command, when the tile may already offer the opposite; it is ignored. */
const AFTER_OPEN_MS = 700;

/**
 * Press and hold a tile to open the home: a bar fills across the tile and the command runs once it is full.
 * Letting go early cancels; a quick tap shows how instead. Keyboards hold Enter or Space the same way.
 */
export function useHoldToOpen(enabled: boolean, onOpen: () => void) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const started = useRef(0);
  const opened = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(onOpen);
  useEffect(() => { latest.current = onOpen; });
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!hint) return;
    const reset = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(reset);
  }, [hint]);

  const start = () => {
    if (!enabled || timer.current) return;
    started.current = Date.now();
    setHint(false);
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      opened.current = Date.now();
      navigator.vibrate?.(30);
      latest.current();
    }, HOLD_MS);
  };
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    if (Date.now() - started.current < TAP_MS) setHint(true);
  };

  const justOpened = () => Date.now() - opened.current < AFTER_OPEN_MS;
  if (!enabled) return { holding: false, hint: false, justOpened, handlers: {} };
  return {
    holding,
    hint,
    justOpened,
    handlers: {
      onPointerDown: start,
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
      onClick: (event: MouseEvent) => event.preventDefault(),
      onKeyDown: (event: KeyboardEvent) => { if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); start(); } },
      onKeyUp: (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") stop(); },
    },
  };
}
