"use client";

import { useEffect } from "react";
import { haptic } from "@/lib/haptics";

const CONTROLS = "button, a[href], [role='button'], [role='switch'], [role='radio'], [role='tab'], [role='option'], [role='menuitem'], [role='checkbox']";

/** A light tick under the finger for every control tapped on a touch screen. Controls with their own feel, such as a hold, mark the click handled. */
export function TapHaptics() {
  useEffect(() => {
    const coarse = matchMedia("(pointer: coarse)");
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !coarse.matches) return;
      const control = (event.target as Element | null)?.closest(CONTROLS);
      if (control && !control.matches(":disabled, [aria-disabled='true']")) haptic("tap");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
