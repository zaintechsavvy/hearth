"use client";

import { useSyncExternalStore } from "react";

export type StudioTab = "gradient" | "photo";

let open: StudioTab | null = null;
const listeners = new Set<() => void>();

/** The background studio lives once in the app shell, so a popover that opens it can close without taking it along. */
export function openStudio(tab: StudioTab) {
  open = tab;
  for (const listener of listeners) listener();
}

export function closeStudio() {
  open = null;
  for (const listener of listeners) listener();
}

export function useStudio() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => open, () => null);
}
