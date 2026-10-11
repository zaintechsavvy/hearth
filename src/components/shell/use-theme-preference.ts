"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, type ThemePreference } from "@/lib/theme";

const EVENT = "hearth-theme";
const dark = () => matchMedia("(prefers-color-scheme: dark)");

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const read = () => (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? "system";

export function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference === "dark" || (preference === "system" && dark().matches) ? "dark" : "light";
}

export function useThemePreference() {
  const preference = useSyncExternalStore(subscribe, read, () => "system" as const);

  useEffect(() => {
    if (preference !== "system") return;
    const query = dark();
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_KEY, next);
    const commit = () => applyTheme(next);
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(commit);
    else commit();
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [preference, setPreference] as const;
}
