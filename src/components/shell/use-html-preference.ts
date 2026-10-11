"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "hearth-preference";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A device-local preference mirrored onto a `data-*` attribute of `<html>`, which the bootstrap script restores before paint. */
export function useHtmlPreference<T extends string>(storageKey: string, attribute: "accent" | "wallpaper", fallback: T) {
  const value = useSyncExternalStore(subscribe, () => (localStorage.getItem(storageKey) as T | null) ?? fallback, () => fallback);
  const set = useCallback((next: T) => {
    localStorage.setItem(storageKey, next);
    document.documentElement.dataset[attribute] = next;
    window.dispatchEvent(new Event(EVENT));
  }, [storageKey, attribute]);
  return [value, set] as const;
}
