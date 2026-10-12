"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The theme actually showing, light or dark, after "system" is resolved. */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark" ? "dark" : "light", () => "light");
}
