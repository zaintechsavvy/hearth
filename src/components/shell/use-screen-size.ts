"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

/** The size of this screen's viewport in CSS pixels, which the resting screen fills; an 11-inch iPad on its side on the server. */
export function useScreenSize() {
  const size = useSyncExternalStore(subscribe, () => `${window.innerWidth}x${window.innerHeight}`, () => "1180x820");
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}
