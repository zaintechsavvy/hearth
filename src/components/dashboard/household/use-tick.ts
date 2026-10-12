"use client";

import { useSyncExternalStore } from "react";

const subscribers = new Map<number, { listeners: Set<() => void>; timer: ReturnType<typeof setInterval> }>();

function subscribe(ms: number, onChange: () => void) {
  let entry = subscribers.get(ms);
  if (!entry) {
    const listeners = new Set<() => void>();
    entry = { listeners, timer: setInterval(() => { for (const listener of listeners) listener(); }, ms) };
    subscribers.set(ms, entry);
  }
  entry.listeners.add(onChange);
  return () => {
    entry.listeners.delete(onChange);
    if (entry.listeners.size === 0) {
      clearInterval(entry.timer);
      subscribers.delete(ms);
    }
  };
}

/** The time, rounded to `ms`, refreshed on one shared interval per resolution. Null during server rendering. */
export function useTick(ms: number): number | null {
  const now = useSyncExternalStore(listener => subscribe(ms, listener), () => Math.floor(Date.now() / ms) * ms, () => 0);
  return now === 0 ? null : now;
}
