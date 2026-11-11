"use client";

import { useEffect } from "react";
import { addTapSwitches, haptic, hapticsOn, removeTapSwitches, ticksWithSwitches } from "@/lib/haptics";
import { guardSliderTouches } from "@/lib/slider-touch";
import { PREFERENCE_EVENT } from "./use-stored-json";

const CONTROLS = "button, a[href], [role='button'], [role='switch'], [role='radio'], [role='tab'], [role='option'], [role='menuitem'], [role='checkbox']";

/**
 * A light tick under the finger for every control tapped on a touch screen. Controls with their own feel, such as a
 * hold, mark the click handled. On an iPhone, controls marked `data-haptic` get the switch that ticks for a tap. A
 * finger scrolling past a slider never moves it.
 */
export function TapHaptics() {
  useEffect(() => {
    const coarse = matchMedia("(pointer: coarse)");
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !coarse.matches) return;
      const control = (event.target as Element | null)?.closest(CONTROLS);
      if (control && !control.matches(":disabled, [aria-disabled='true']")) haptic("tap");
    };
    document.addEventListener("click", onClick);
    const unguard = guardSliderTouches();
    if (!ticksWithSwitches()) return () => { document.removeEventListener("click", onClick); unguard(); };

    const sync = () => {
      if (hapticsOn()) addTapSwitches(document.body);
      else removeTapSwitches();
    };
    sync();
    const changes = new MutationObserver(sync);
    changes.observe(document.body, { childList: true, subtree: true });
    window.addEventListener(PREFERENCE_EVENT, sync);
    return () => {
      document.removeEventListener("click", onClick);
      unguard();
      changes.disconnect();
      window.removeEventListener(PREFERENCE_EVENT, sync);
      removeTapSwitches();
    };
  }, []);
  return null;
}
