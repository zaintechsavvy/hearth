"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "hearth-preference";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A device-local JSON preference, shared live between every component that reads it. */
export function useStoredJson<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
  const value = useMemo<T>(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
  const set = useCallback((next: T) => {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set] as const;
}
